import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { setBookingStatus } from "@/lib/bookings/setBookingStatus";

type ExpirePendingAcceptanceResult =
  | { ok: true; action: "refunded" | "cancelled_authorization" | "already_refunded" | "already_terminal" | "not_due"; bookingId: string }
  | { ok: false; action: "refund_failed"; bookingId: string; error: string };

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function expirePendingAcceptanceBooking(params: {
  bookingId: string;
  req?: NextRequest;
  thresholdHours: number;
  now?: Date;
}) : Promise<ExpirePendingAcceptanceResult> {
  const bookingId = normalizeString(params.bookingId);
  const now = params.now instanceof Date ? params.now : new Date();
  const thresholdHours = Number.isFinite(params.thresholdHours) ? Math.max(1, Math.trunc(params.thresholdHours)) : 24;

  if (!bookingId) {
    return { ok: false, action: "refund_failed", bookingId: "", error: "INVALID_BOOKING_ID" };
  }

  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      startDate: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
      stripeTransferId: true,
      stripeRefundId: true,
      refundedAt: true,
      canceledAt: true,
    },
  });

  if (!booking) {
    return { ok: false, action: "refund_failed", bookingId, error: "NOT_FOUND" };
  }

  const status = normalizeString(booking.status);
  if (status === "REFUNDED" || status === "CANCELLED" || status === "REFUND_FAILED") {
    return { ok: true, action: "already_terminal", bookingId };
  }

  if (status !== "PENDING_ACCEPTANCE" && status !== "PAID") {
    return { ok: true, action: "already_terminal", bookingId };
  }

  const startDate = booking.startDate instanceof Date ? booking.startDate : booking.startDate ? new Date(booking.startDate) : null;
  if (!startDate || !Number.isFinite(startDate.getTime())) {
    return { ok: false, action: "refund_failed", bookingId, error: "MISSING_START_DATE" };
  }

  const remainingMs = startDate.getTime() - now.getTime();
  if (remainingMs > thresholdHours * 60 * 60 * 1000) {
    return { ok: true, action: "not_due", bookingId };
  }

  const paymentIntentId = normalizeString(booking.stripePaymentIntentId);
  const existingRefundId = normalizeString(booking.stripeRefundId);
  const existingChargeId = normalizeString(booking.stripeChargeId);
  const transferId = normalizeString(booking.stripeTransferId);
  const alreadyRefunded = Boolean(existingRefundId || booking.refundedAt);
  const canceledAt = new Date();

  console.log("[bookings][auto-expire-pending-acceptance] start", {
    bookingId,
    status,
    thresholdHours,
    now: now.toISOString(),
    startDate: startDate.toISOString(),
    paymentIntentId: paymentIntentId || null,
    alreadyRefunded,
  });

  if (!paymentIntentId) {
    await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { canceledAt },
      select: { id: true },
    });
    await setBookingStatus(bookingId, "REFUND_FAILED" as any, { req: params.req });
    return { ok: false, action: "refund_failed", bookingId, error: "MISSING_PAYMENT_INTENT" };
  }

  if (alreadyRefunded) {
    await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { canceledAt },
      select: { id: true },
    });
    await setBookingStatus(bookingId, "REFUNDED" as any, {
      req: params.req,
      notificationContext: { refundReason: "auto_expired_unaccepted" },
    });
    return { ok: true, action: "already_refunded", bookingId };
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const intentStatus = normalizeString(intent.status);

    if (intentStatus === "requires_capture") {
      await stripe.paymentIntents.cancel(
        paymentIntentId,
        {},
        {
          idempotencyKey: `cancel:auto_expire:${bookingId}:${paymentIntentId}`,
        }
      );

      await (prisma as any).booking.update({
        where: { id: bookingId },
        data: {
          canceledAt,
          refundedAt: new Date(),
        },
        select: { id: true },
      });

      await setBookingStatus(bookingId, "REFUNDED" as any, {
        req: params.req,
        notificationContext: { refundReason: "auto_expired_unaccepted" },
      });

      console.log("[bookings][auto-expire-pending-acceptance] authorization-cancelled", {
        bookingId,
        paymentIntentId,
      });

      return { ok: true, action: "cancelled_authorization", bookingId };
    }

    const expandedLatestChargeId = typeof (intent as any)?.latest_charge?.id === "string" ? String((intent as any).latest_charge.id) : "";
    const latestChargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : "";
    let resolvedChargeId = existingChargeId || expandedLatestChargeId || latestChargeId;

    if (!resolvedChargeId) {
      const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });
      resolvedChargeId = typeof charges?.data?.[0]?.id === "string" ? charges.data[0].id : "";
    }

    if (!resolvedChargeId) {
      await (prisma as any).booking.update({
        where: { id: bookingId },
        data: { canceledAt },
        select: { id: true },
      });
      await setBookingStatus(bookingId, "REFUND_FAILED" as any, { req: params.req });
      return { ok: false, action: "refund_failed", bookingId, error: "MISSING_CHARGE" };
    }

    const refund = await stripe.refunds.create(
      {
        charge: resolvedChargeId,
        reason: "requested_by_customer",
        ...(transferId ? { reverse_transfer: true, refund_application_fee: true } : null),
        metadata: {
          bookingId,
          flow: "auto_expire_pending_acceptance",
        },
      } as any,
      {
        idempotencyKey: `refund:auto_expire:${bookingId}:${paymentIntentId}`,
      }
    );

    await (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        canceledAt,
        stripeChargeId: resolvedChargeId,
        stripeRefundId: refund.id,
        refundedAt: new Date(),
      },
      select: { id: true },
    });

    await setBookingStatus(bookingId, "REFUNDED" as any, {
      req: params.req,
      notificationContext: { refundReason: "auto_expired_unaccepted" },
    });

    console.log("[bookings][auto-expire-pending-acceptance] refunded", {
      bookingId,
      paymentIntentId,
      chargeId: resolvedChargeId,
      refundId: refund.id,
    });

    return { ok: true, action: "refunded", bookingId };
  } catch (err) {
    console.error("[bookings][auto-expire-pending-acceptance] failed", {
      bookingId,
      paymentIntentId,
      err,
    });

    await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { canceledAt },
      select: { id: true },
    });
    await setBookingStatus(bookingId, "REFUND_FAILED" as any, { req: params.req });

    return {
      ok: false,
      action: "refund_failed",
      bookingId,
      error: err instanceof Error ? err.message : "REFUND_FAILED",
    };
  }
}
