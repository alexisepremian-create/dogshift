import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { stripe } from "@/lib/stripe";
import { syncBookingPaymentDetails } from "@/lib/stripe/bookingPayments";
import { estimateStripePaymentFeeCents } from "@/lib/stripe/paymentFeeEstimate";
import { transitionBookingAfterStripePaymentSuccess } from "@/lib/bookings/transitionBookingAfterPayment";

export const runtime = "nodejs";

function isPrismaInconsistentResultError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("inconsistent query result") || msg.includes("P2025");
}

type BookingDetailResponse = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sitterId: string;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  message: string | null;
  status: string;
  canceledAt: string | null;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  stripePaymentIntentId: string | null;
  sitter: {
    sitterId: string;
    name: string;
    avatarUrl: string | null;
    city: string | null;
    postalCode: string | null;
  };
};

function normalizeMeta(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function paymentIntentMatchesBooking(
  intent: { metadata?: Record<string, string> | null; amount?: number | null },
  booking: { id: string; sitterId: string; amount: number; currency: string }
) {
  const metaBookingId = normalizeMeta(intent.metadata?.bookingId);
  if (metaBookingId && metaBookingId !== booking.id) {
    return { ok: false as const, reason: "metadata_booking_mismatch" as const };
  }

  const metaSitterId = normalizeMeta(intent.metadata?.sitterId);
  if (metaSitterId && metaSitterId !== booking.sitterId) {
    return { ok: false as const, reason: "metadata_sitter_mismatch" as const };
  }

  if (!metaBookingId) {
    const currency = String(booking.currency ?? "").toLowerCase();
    if (currency !== "chf") {
      return { ok: false as const, reason: "unsupported_currency" as const };
    }
    if (typeof booking.amount !== "number" || !Number.isFinite(booking.amount) || booking.amount < 100) {
      return { ok: false as const, reason: "invalid_booking_amount" as const };
    }
    const expectedTotal = booking.amount + estimateStripePaymentFeeCents(booking.amount);
    if (typeof intent.amount !== "number" || intent.amount !== expectedTotal) {
      return { ok: false as const, reason: "amount_mismatch" as const };
    }
  }

  return { ok: true as const };
}

async function reconcileBookingPaymentIfNeeded(
  booking: {
    id: string;
    status: string;
    stripePaymentIntentId: string | null;
    sitterId: string;
    amount: number;
    currency: string;
  },
  req: NextRequest
) {
  const status = String(booking.status ?? "");
  const paymentIntentId = typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId : "";

  if (status !== "PENDING_PAYMENT" || !paymentIntentId) return null;

  console.log("[api][account][bookings][id][GET] reconcile start", {
    bookingId: booking.id,
    paymentIntentId,
  });

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const intentStatus = typeof intent.status === "string" ? intent.status : "";

    if (intentStatus === "requires_payment_method" || intentStatus === "canceled") {
      await (prisma as any).booking.updateMany({
        where: {
          id: booking.id,
          status: "PENDING_PAYMENT",
        },
        data: {
          status: "PAYMENT_FAILED",
          stripePaymentIntentId: paymentIntentId,
        },
      });

      console.log("[api][account][bookings][id][GET] reconcile failed", {
        bookingId: booking.id,
        paymentIntentId,
        intentStatus,
      });

      return "PAYMENT_FAILED";
    }

    if (intentStatus !== "succeeded") {
      console.log("[api][account][bookings][id][GET] reconcile skip", {
        bookingId: booking.id,
        paymentIntentId,
        intentStatus: intentStatus || null,
      });
      return null;
    }

    const match = paymentIntentMatchesBooking(intent as { metadata?: Record<string, string> | null; amount?: number | null }, {
      id: booking.id,
      sitterId: booking.sitterId,
      amount: booking.amount,
      currency: booking.currency,
    });
    if (!match.ok) {
      console.warn("[api][account][bookings][id][GET] reconcile succeeded but intent does not match booking; skip transition", {
        bookingId: booking.id,
        paymentIntentId,
        reason: match.reason,
      });
      return null;
    }

    await (prisma as any).booking.update({
      where: { id: booking.id },
      data: {
        stripePaymentIntentId: paymentIntentId,
      },
      select: { id: true },
    });

    await syncBookingPaymentDetails({
      bookingId: booking.id,
      paymentIntentId,
    });

    const res = await transitionBookingAfterStripePaymentSuccess(req, booking.id, {
      source: "account-booking-get-reconcile",
    });

    console.log("[api][account][bookings][id][GET] reconcile updated", {
      bookingId: booking.id,
      paymentIntentId,
      changed: res.changed,
      targetStatus: "targetStatus" in res ? res.targetStatus : null,
      ok: res.ok,
    });

    if (res.ok && res.changed && "targetStatus" in res && res.targetStatus) {
      return res.targetStatus;
    }
  } catch (err) {
    console.error("[api][account][bookings][id][GET] reconcile error", {
      bookingId: booking.id,
      paymentIntentId,
      err,
    });
  }

  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][GET] UNAUTHORIZED");
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = await params;
    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!bookingId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][GET] INVALID_ID", { bookingIdRaw: resolvedParams?.id });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        sitterId: true,
        service: true,
        startDate: true,
        endDate: true,
        message: true,
        status: true,
        canceledAt: true,
        amount: true,
        currency: true,
        platformFeeAmount: true,
        stripePaymentIntentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const reconciledStatus = await reconcileBookingPaymentIfNeeded(
      {
        id: String(booking.id),
        status: String(booking.status ?? ""),
        stripePaymentIntentId: typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId : null,
        sitterId: String(booking.sitterId ?? ""),
        amount: typeof booking.amount === "number" ? booking.amount : 0,
        currency: typeof booking.currency === "string" ? booking.currency : "",
      },
      req
    );

    const sitterKey = typeof booking?.sitterId === "string" ? booking.sitterId.trim() : "";
    const sitterUser = await (prisma as any).user.findFirst({
      where: {
        OR: [{ sitterId: sitterKey }, { id: sitterKey }],
      },
      select: {
        id: true,
        sitterId: true,
        name: true,
        image: true,
        sitterProfile: { select: { displayName: true, avatarUrl: true, city: true, postalCode: true } },
      },
    });

    const displayName =
      (typeof sitterUser?.sitterProfile?.displayName === "string" && sitterUser.sitterProfile.displayName.trim()
        ? sitterUser.sitterProfile.displayName.trim()
        : null) ??
      (typeof sitterUser?.name === "string" && sitterUser.name.trim() ? sitterUser.name.trim() : "Dogsitter");

    const avatarUrlRaw =
      (typeof sitterUser?.sitterProfile?.avatarUrl === "string" && sitterUser.sitterProfile.avatarUrl.trim()
        ? sitterUser.sitterProfile.avatarUrl.trim()
        : null) ??
      (typeof sitterUser?.image === "string" && sitterUser.image.trim() ? sitterUser.image.trim() : null);

    const city =
      typeof sitterUser?.sitterProfile?.city === "string" && sitterUser.sitterProfile.city.trim()
        ? sitterUser.sitterProfile.city.trim()
        : null;
    const postalCode =
      typeof sitterUser?.sitterProfile?.postalCode === "string" && sitterUser.sitterProfile.postalCode.trim()
        ? sitterUser.sitterProfile.postalCode.trim()
        : null;

    const payload: BookingDetailResponse = {
      id: String(booking.id),
      createdAt: booking.createdAt instanceof Date ? booking.createdAt.toISOString() : new Date(booking.createdAt).toISOString(),
      updatedAt: booking.updatedAt instanceof Date ? booking.updatedAt.toISOString() : new Date(booking.updatedAt).toISOString(),
      sitterId: String(booking.sitterId),
      service: typeof booking.service === "string" ? booking.service : null,
      startDate: booking.startDate instanceof Date ? booking.startDate.toISOString() : booking.startDate ? new Date(booking.startDate).toISOString() : null,
      endDate: booking.endDate instanceof Date ? booking.endDate.toISOString() : booking.endDate ? new Date(booking.endDate).toISOString() : null,
      message: typeof booking.message === "string" ? booking.message : null,
      status: reconciledStatus ?? String(booking.status ?? "PENDING_PAYMENT"),
      canceledAt: booking.canceledAt instanceof Date ? booking.canceledAt.toISOString() : booking.canceledAt ? new Date(booking.canceledAt).toISOString() : null,
      amount: typeof booking.amount === "number" ? booking.amount : 0,
      currency: typeof booking.currency === "string" ? booking.currency : "chf",
      platformFeeAmount: typeof booking.platformFeeAmount === "number" ? booking.platformFeeAmount : 0,
      stripePaymentIntentId: typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId : null,
      sitter: {
        sitterId: String((typeof sitterUser?.sitterId === "string" && sitterUser.sitterId) || booking.sitterId || ""),
        name: displayName,
        avatarUrl: avatarUrlRaw,
        city,
        postalCode,
      },
    };

    return NextResponse.json({ ok: true, booking: payload }, { status: 200 });
  } catch (err) {
    if (isPrismaInconsistentResultError(err)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][GET] INCONSISTENT_RESULT", { err });
      }
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][bookings][id][GET] error", { err });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
