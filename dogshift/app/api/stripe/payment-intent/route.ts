import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { estimateStripePaymentFeeCents } from "@/lib/stripe/paymentFeeEstimate";

export const runtime = "nodejs";

type Body = {
  bookingId?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const db = prisma as any;
    const userId = await resolveDbUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) return NextResponse.json({ ok: false, error: "INVALID_BOOKING" }, { status: 400 });

    const startedAt = Date.now();
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

    const paymentFeeAmount = estimateStripePaymentFeeCents(booking.amount);
    const totalOwnerAmount = booking.amount + paymentFeeAmount;

    if (!Number.isFinite(totalOwnerAmount) || totalOwnerAmount <= 0 || !Number.isInteger(totalOwnerAmount)) {
      return NextResponse.json({ ok: false, error: "INVALID_TOTAL_AMOUNT" }, { status: 500 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[api][stripe][payment-intent] compute", {
        bookingId: booking.id,
        bookingAmount: booking.amount,
        paymentFeeAmount,
        totalOwnerAmount,
        durationMs: Date.now() - startedAt,
      });
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
        const existingTypes = Array.isArray((existing as any).payment_method_types) ? ((existing as any).payment_method_types as unknown[]) : [];
        const normalizedTypes = existingTypes.map((t) => String(t)).filter(Boolean).sort();
        const canReuse = normalizedTypes.length === 2 && normalizedTypes[0] === "card" && normalizedTypes[1] === "twint";
        const amountMatches = typeof (existing as any).amount === "number" && (existing as any).amount === totalOwnerAmount;

        console.log("[api][stripe][payment-intent] existing", {
          bookingId: booking.id,
          paymentIntentId: existing.id,
          status: existing.status,
          livemode: existing.livemode,
          payment_method_types: normalizedTypes,
          canReuse,
          amount: (existing as any).amount,
          expectedAmount: totalOwnerAmount,
          amountMatches,
        });

        if (canReuse && amountMatches && typeof existing.client_secret === "string" && existing.client_secret.includes("_secret_")) {
          return NextResponse.json(
            {
              ok: true,
              clientSecret: existing.client_secret,
              intentId: existing.id,
              livemode: existing.livemode,
              paymentFeeAmount,
              totalOwnerAmount,
              reused: true,
            },
            { status: 200 }
          );
        }

        // Do not reuse intents that allow other payment methods (Klarna/Amazon/etc.),
        // otherwise they can reappear in the UI even if the backend was updated.
        try {
          if (existing.status !== "succeeded" && existing.status !== "canceled") {
            await stripe.paymentIntents.cancel(existing.id);
          }
        } catch (cancelErr) {
          console.warn("[api][stripe][payment-intent] cancel existing PI failed", {
            bookingId: booking.id,
            paymentIntentId: existing.id,
          });
          void cancelErr;
        }
      } catch (err) {
        console.error("[api][stripe][payment-intent] retrieve existing PI failed", err);
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: totalOwnerAmount,
      currency: "chf",
      // Keep checkout Switzerland-simple: TWINT + card only.
      // Apple Pay stays available via card wallets on supported devices, but we keep it out of PaymentElement UI.
      payment_method_types: ["card", "twint"],
      metadata: {
        bookingId: booking.id,
        sitterId: booking.sitterId,
        userId,
        paymentFeeAmount: String(paymentFeeAmount),
        totalOwnerAmount: String(totalOwnerAmount),
      },
    });

    console.log("[api][stripe][payment-intent] created", {
      bookingId: booking.id,
      paymentIntentId: intent.id,
      amount: totalOwnerAmount,
      currency: "chf",
      livemode: intent.livemode,
      destination,
      payoutMode: "delayed_manual_transfer",
      paymentFeeAmount,
      totalOwnerAmount,
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
      {
        ok: true,
        clientSecret: intent.client_secret,
        intentId: intent.id,
        livemode: intent.livemode,
        paymentFeeAmount,
        totalOwnerAmount,
        reused: false,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Missing STRIPE_SECRET_KEY") {
      console.error("[api][stripe][payment-intent] Missing STRIPE_SECRET_KEY");
      return NextResponse.json({ ok: false, error: "MISSING_STRIPE_SECRET_KEY" }, { status: 500 });
    }
    console.error("[api][stripe][payment-intent] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
