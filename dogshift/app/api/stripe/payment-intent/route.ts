import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

type Body = {
  bookingId?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const db = prisma as any;
    const userId = await resolveDbUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) return NextResponse.json({ ok: false, error: "INVALID_BOOKING" }, { status: 400 });

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        sitterId: true,
        status: true,
        amount: true,
        currency: true,
        stripePaymentIntentId: true,
      },
    });

    if (!booking) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (booking.userId !== userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    if (booking.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
    }

    if (typeof booking.currency !== "string" || booking.currency.toLowerCase() !== "chf") {
      return NextResponse.json({ ok: false, error: "INVALID_CURRENCY" }, { status: 400 });
    }

    if (
      typeof booking.amount !== "number" ||
      !Number.isFinite(booking.amount) ||
      booking.amount < 100 ||
      !Number.isInteger(booking.amount)
    ) {
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const sitterProfile = await db.sitterProfile.findUnique({
      where: { sitterId: booking.sitterId },
      select: { stripeAccountId: true, stripeAccountStatus: true },
    });

    const destination = typeof sitterProfile?.stripeAccountId === "string" ? sitterProfile.stripeAccountId.trim() : "";
    const destinationStatus = typeof sitterProfile?.stripeAccountStatus === "string" ? sitterProfile.stripeAccountStatus.trim() : "";
    if (!destination) {
      return NextResponse.json({ ok: false, error: "SITTER_STRIPE_NOT_CONNECTED" }, { status: 409 });
    }
    if (destinationStatus !== "ENABLED") {
      return NextResponse.json({ ok: false, error: "SITTER_STRIPE_NOT_READY" }, { status: 409 });
    }

    if (typeof booking.stripePaymentIntentId === "string" && booking.stripePaymentIntentId.trim()) {
      try {
        const existing = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
        if (typeof existing.client_secret === "string" && existing.client_secret.includes("_secret_")) {
          return NextResponse.json(
            { ok: true, clientSecret: existing.client_secret, intentId: existing.id, livemode: existing.livemode },
            { status: 200 }
          );
        }
      } catch (err) {
        console.error("[api][stripe][payment-intent] retrieve existing PI failed", err);
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: booking.amount,
      currency: "chf",
      automatic_payment_methods: { enabled: true },
      application_fee_amount: 0,
      transfer_data: {
        destination,
      },
      metadata: {
        bookingId: booking.id,
        sitterId: booking.sitterId,
        userId,
      },
    });

    if (typeof intent.client_secret !== "string" || !intent.client_secret.includes("_secret_")) {
      console.error("[api][stripe][payment-intent] missing client_secret", { intentId: intent.id });
      return NextResponse.json({ ok: false, error: "MISSING_CLIENT_SECRET" }, { status: 500 });
    }

    await db.booking.update({
      where: { id: booking.id },
      data: { stripePaymentIntentId: intent.id, stripeApplicationFeeAmount: 0 },
      select: { id: true },
    });

    return NextResponse.json(
      { ok: true, clientSecret: intent.client_secret, intentId: intent.id, livemode: intent.livemode },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][stripe][payment-intent] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
