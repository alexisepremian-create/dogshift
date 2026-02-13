import type { NextRequest } from "next/server";

import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { resolveBookingParticipants, sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

export async function setBookingStatus(
  bookingId: string,
  nextStatus: BookingStatus,
  opts?: {
    req?: NextRequest;
  }
) {
  const id = (bookingId || "").trim();
  if (!id) return { ok: false as const, error: "INVALID_BOOKING_ID" as const };

  const booking = await (prisma as any).booking.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!booking) return { ok: false as const, error: "NOT_FOUND" as const };

  const currentStatus = String(booking.status ?? "") as BookingStatus;

  if (currentStatus === nextStatus) {
    return { ok: true as const, changed: false as const, previousStatus: currentStatus, nextStatus };
  }

  if (nextStatus === "PAID" && (currentStatus === "CONFIRMED" || currentStatus === "CANCELLED" || currentStatus === "REFUNDED")) {
    return { ok: true as const, changed: false as const, previousStatus: currentStatus, nextStatus };
  }

  const updated = await (prisma as any).booking.update({
    where: { id },
    data: { status: nextStatus },
    select: { id: true, status: true },
  });

  const changed = String(updated?.status ?? "") === nextStatus;
  if (!changed) {
    return { ok: true as const, changed: false as const, previousStatus: currentStatus, nextStatus };
  }

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
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: sitterId,
          key: "bookingConfirmed",
          entityId: id,
          payload: { kind: "bookingConfirmed", bookingId: id },
        });
      }
    }

    if (nextStatus === "CANCELLED") {
      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "bookingCancelled",
          entityId: id,
          payload: { kind: "bookingCancelled", bookingId: id, dashboard: "account" },
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
      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "bookingRefunded",
          entityId: id,
          payload: { kind: "bookingRefunded", bookingId: id, dashboard: "account" },
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
      if (ownerId) {
        await sendNotificationEmail({
          req: opts?.req,
          recipientUserId: ownerId,
          key: "bookingRefundFailed",
          entityId: id,
          payload: { kind: "bookingRefundFailed", bookingId: id, dashboard: "account" },
        });
      }
    }
  } catch (err) {
    console.error("[bookings][setBookingStatus] email failed", { bookingId: id, nextStatus, err });
  }

  return { ok: true as const, changed: true as const, previousStatus: currentStatus, nextStatus };
}
