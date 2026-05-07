import type { NextRequest } from "next/server";

import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { computeEligibleRefund, resolveBookingParticipants, sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

export async function setBookingStatus(
  bookingId: string,
  nextStatus: BookingStatus,
  opts?: {
    req?: NextRequest;
    notificationContext?: {
      refundReason?: "auto_expired_unaccepted";
      deadlineHours?: number;
      cancelledBy?: "owner" | "sitter" | "system";
    };
  }
) {
  const id = (bookingId || "").trim();
  if (!id) return { ok: false as const, error: "INVALID_BOOKING_ID" as const };

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, status: true, startDate: true, endDate: true, amount: true, currency: true, sitterId: true },
  });

  if (!booking) return { ok: false as const, error: "NOT_FOUND" as const };

  if (nextStatus === "PAID" || nextStatus === "CONFIRMED") {
    if (!booking.startDate) {
      console.error("[bookings][setBookingStatus] missing startDate for status transition", {
        bookingId: id,
        nextStatus,
        currentStatus: String(booking.status ?? ""),
      });
      return { ok: false as const, error: "MISSING_START_DATE" as const };
    }
    if (!booking.endDate) {
      console.error("[bookings][setBookingStatus] missing endDate for status transition", {
        bookingId: id,
        nextStatus,
        currentStatus: String(booking.status ?? ""),
      });
      return { ok: false as const, error: "MISSING_END_DATE" as const };
    }
  }

  const currentStatus = String(booking.status ?? "") as BookingStatus;

  console.log("[bookings][setBookingStatus] transition requested", {
    bookingId: id,
    currentStatus,
    nextStatus,
  });

  if (currentStatus === nextStatus) {
    return { ok: true as const, changed: false as const, previousStatus: currentStatus, nextStatus };
  }

  if (nextStatus === "PAID" && (currentStatus === "CONFIRMED" || currentStatus === "CANCELLED" || currentStatus === "REFUNDED")) {
    return { ok: true as const, changed: false as const, previousStatus: currentStatus, nextStatus };
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: nextStatus },
    select: { id: true, status: true },
  });

  const changed = String(updated?.status ?? "") === nextStatus;
  if (!changed) {
    return { ok: true as const, changed: false as const, previousStatus: currentStatus, nextStatus };
  }

  console.log("[bookings][setBookingStatus] transition applied", {
    bookingId: id,
    previousStatus: currentStatus,
    nextStatus,
  });

  try {
    const participants = await resolveBookingParticipants(id);
    const ownerId = participants?.owner?.id || null;
    const sitterId = participants?.sitter?.id || null;

    if (nextStatus === "PAID") {
      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "paymentReceived",
          entityId: `${id}:payment_received`,
          payload: { kind: "paymentReceived", bookingId: id },
        });
      }
      if (sitterId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: sitterId,
          key: "newBookingRequest",
          entityId: `${id}:pending_acceptance`,
          payload: { kind: "bookingRequest", bookingId: id },
        });
      }
    }

    if (nextStatus === "CONFIRMED") {
      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "bookingConfirmed",
          entityId: id,
          payload: { kind: "bookingConfirmed", bookingId: id },
        });
      }
      if (sitterId) {
        // Sitter gets a dedicated sitter-facing confirmation email (different CTA, wording, dog details)
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: sitterId,
          key: "sitterBookingConfirmed",
          entityId: `${id}:sitter`,
          payload: { kind: "sitterBookingConfirmed", bookingId: id },
        });
      }
    }

    if (nextStatus === "CANCELLED") {
      const startDate = booking.startDate ? new Date(booking.startDate) : null;
      const eligibleRefund = computeEligibleRefund(startDate, new Date());
      const cancelledBy = opts?.notificationContext?.cancelledBy || "owner";
      const amountCents = typeof booking.amount === "number" ? booking.amount : undefined;
      const currency = typeof booking.currency === "string" ? booking.currency : undefined;

      let sitterName: string | undefined;
      if (booking.sitterId) {
        try {
          const sp = await prisma.sitterProfile.findUnique({
            where: { sitterId: booking.sitterId },
            select: { displayName: true },
          });
          sitterName = typeof sp?.displayName === "string" && sp.displayName.trim() ? sp.displayName.trim() : undefined;
        } catch { /* non-critical */ }
      }

      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "bookingCancelled",
          entityId: id,
          payload: { kind: "bookingCancelled", bookingId: id, dashboard: "account", eligibleRefund, cancelledBy, sitterName, amountCents, currency },
        });
      }
      if (sitterId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: sitterId,
          key: "bookingCancelled",
          entityId: id,
          payload: { kind: "bookingCancelled", bookingId: id, dashboard: "host" },
        });
      }
    }

    if (nextStatus === "REFUNDED") {
      const refundAmountCents = typeof booking.amount === "number" ? booking.amount : undefined;
      const refundCurrency = typeof booking.currency === "string" ? booking.currency : undefined;
      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "bookingRefunded",
          entityId:
            opts?.notificationContext?.refundReason === "auto_expired_unaccepted"
              ? `${id}:auto_expired_refunded`
              : id,
          payload:
            opts?.notificationContext?.refundReason === "auto_expired_unaccepted"
              ? {
                  kind: "bookingAutoExpiredRefunded",
                  bookingId: id,
                  deadlineHours: opts?.notificationContext?.deadlineHours ?? 24,
                  amountCents: refundAmountCents,
                  currency: refundCurrency,
                }
              : { kind: "bookingRefunded", bookingId: id, dashboard: "account", amountCents: refundAmountCents, currency: refundCurrency },
        });
      }
      if (sitterId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: sitterId,
          key: "bookingRefunded",
          entityId: id,
          payload: { kind: "bookingRefunded", bookingId: id, dashboard: "host" },
        });
      }
    }

    if (nextStatus === "REFUND_FAILED") {
      const failAmountCents = typeof booking.amount === "number" ? booking.amount : undefined;
      const failCurrency = typeof booking.currency === "string" ? booking.currency : undefined;
      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "bookingRefundFailed",
          entityId: id,
          payload: { kind: "bookingRefundFailed", bookingId: id, dashboard: "account", amountCents: failAmountCents, currency: failCurrency },
        });
      }
    }
  } catch (err) {
    console.error("[bookings][setBookingStatus] email failed", { bookingId: id, nextStatus, err });
  }

  return { ok: true as const, changed: true as const, previousStatus: currentStatus, nextStatus };
}
