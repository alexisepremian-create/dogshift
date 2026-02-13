import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { setBookingStatus } from "@/lib/bookings/setBookingStatus";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

function warn409(params: {
  bookingId: string;
  status: string;
  startDate: unknown;
  endDate: unknown;
  error: string;
}) {
  console.warn("[api][account][bookings][id][cancel][PATCH] 409", {
    bookingId: params.bookingId,
    status: params.status,
    startDate: params.startDate instanceof Date ? params.startDate.toISOString() : params.startDate ?? null,
    endDate: params.endDate instanceof Date ? params.endDate.toISOString() : params.endDate ?? null,
    now: new Date().toISOString(),
    error: params.error,
  });
}

function isCompleted(status: string, endDateIso: string | null) {
  if (status !== "PAID" && status !== "CONFIRMED") return false;
  if (!endDateIso) return false;
  const end = new Date(endDateIso).getTime();
  if (!Number.isFinite(end)) return false;
  return Date.now() > end;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][cancel][PATCH] UNAUTHORIZED");
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!bookingId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][cancel][PATCH] INVALID_ID", { bookingIdRaw: resolvedParams?.id });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        status: true,
        startDate: true,
        endDate: true,
        stripePaymentIntentId: true,
        stripeRefundId: true,
        refundedAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = String(booking.status ?? "");

    const startIso = booking.startDate instanceof Date ? booking.startDate.toISOString() : booking.startDate ? new Date(booking.startDate).toISOString() : null;
    if (status === "CONFIRMED" && !startIso) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_START_DATE",
          message: "Impossible d’annuler cette réservation car sa date de début est manquante. Contacte le support.",
        },
        { status: 400 }
      );
    }
    const startTs = startIso ? new Date(startIso).getTime() : NaN;
    const limit = Number.isFinite(startTs) ? startTs - 24 * 60 * 60 * 1000 : NaN;
    const isTooLateByStartDate = Number.isFinite(limit) ? Date.now() > limit : false;

    if (status === "CONFIRMED" && isTooLateByStartDate) {
      warn409({ bookingId, status, startDate: booking.startDate, endDate: booking.endDate, error: "CANNOT_CANCEL_TOO_LATE" });
      return NextResponse.json({ ok: false, error: "CANNOT_CANCEL_TOO_LATE" }, { status: 409 });
    }

    if (status === "CANCELLED") {
      warn409({ bookingId, status, startDate: booking.startDate, endDate: booking.endDate, error: "ALREADY_CANCELED" });
      return NextResponse.json({ ok: false, error: "ALREADY_CANCELED" }, { status: 409 });
    }

    const endIso = booking.endDate instanceof Date ? booking.endDate.toISOString() : booking.endDate ? new Date(booking.endDate).toISOString() : null;
    if (isCompleted(status, endIso)) {
      warn409({ bookingId, status, startDate: booking.startDate, endDate: booking.endDate, error: "ALREADY_COMPLETED" });
      return NextResponse.json({ ok: false, error: "ALREADY_COMPLETED" }, { status: 409 });
    }

    if (status !== "CONFIRMED" && isTooLateByStartDate) {
      warn409({ bookingId, status, startDate: booking.startDate, endDate: booking.endDate, error: "TOO_LATE" });
      return NextResponse.json({ ok: false, error: "TOO_LATE" }, { status: 409 });
    }

    const canceledAt = new Date();

    if (status === "DRAFT" || status === "PENDING_PAYMENT" || status === "PAYMENT_FAILED") {
      const updated = await (prisma as any).booking.update({
        where: { id: bookingId },
        data: {
          canceledAt,
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          updatedAt: true,
          canceledAt: true,
        },
      });

      const res = await setBookingStatus(bookingId, "CANCELLED" as any, { req });
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

      return NextResponse.json({ ok: true, booking: { ...updated, status: "CANCELLED" } }, { status: 200 });
    }

    if (status === "PAID" || status === "PENDING_ACCEPTANCE" || status === "CONFIRMED") {
      const paymentIntentId =
        typeof booking.stripePaymentIntentId === "string" && booking.stripePaymentIntentId.trim()
          ? booking.stripePaymentIntentId.trim()
          : "";

      const alreadyRefunded =
        (typeof booking.stripeRefundId === "string" && booking.stripeRefundId.trim()) || Boolean(booking.refundedAt);

      if (!paymentIntentId) {
        warn409({ bookingId, status, startDate: booking.startDate, endDate: booking.endDate, error: "MISSING_PAYMENT_INTENT" });
        return NextResponse.json({ ok: false, error: "MISSING_PAYMENT_INTENT" }, { status: 409 });
      }

      if (alreadyRefunded) {
        const updated = await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            canceledAt,
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            updatedAt: true,
            canceledAt: true,
            stripeRefundId: true,
            refundedAt: true,
          },
        });

        const res = await setBookingStatus(bookingId, "REFUNDED" as any, { req });
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

        return NextResponse.json({ ok: true, booking: { ...updated, status: "REFUNDED" } }, { status: 200 });
      }

      try {
        const intent = (await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["charges.data.transfer"] })) as any;
        const chargeId = typeof intent?.charges?.data?.[0]?.id === "string" ? String(intent.charges.data[0].id) : "";
        if (!chargeId) {
          warn409({ bookingId, status, startDate: booking.startDate, endDate: booking.endDate, error: "MISSING_CHARGE" });
          return NextResponse.json({ ok: false, error: "MISSING_CHARGE" }, { status: 409 });
        }

        const refund = await stripe.refunds.create(
          {
            charge: chargeId,
            reason: "requested_by_customer",
            reverse_transfer: true,
            refund_application_fee: true,
          } as any,
          {
            idempotencyKey: `refund:owner_cancel:${bookingId}:${paymentIntentId}`,
          }
        );

        const updated = await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            canceledAt,
            stripeRefundId: refund.id,
            refundedAt: new Date(),
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            updatedAt: true,
            canceledAt: true,
            stripeRefundId: true,
            refundedAt: true,
          },
        });

        const res = await setBookingStatus(bookingId, "REFUNDED" as any, { req });
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

        return NextResponse.json({ ok: true, booking: { ...updated, status: "REFUNDED" } }, { status: 200 });
      } catch (err) {
        console.error("[api][account][bookings][id][cancel][PATCH] refund failed", { bookingId, err });

        const updated = await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            canceledAt,
          },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            updatedAt: true,
            canceledAt: true,
          },
        });

        const res = await setBookingStatus(bookingId, "REFUND_FAILED" as any, { req });
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 });

        return NextResponse.json(
          { ok: false, error: "REFUND_FAILED", booking: { ...updated, status: "REFUND_FAILED" } },
          { status: 502 }
        );
      }
    }

    warn409({ bookingId, status, startDate: booking.startDate, endDate: booking.endDate, error: "INVALID_STATUS" });
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
  } catch (err) {
    console.error("[api][account][bookings][id][cancel][PATCH] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
