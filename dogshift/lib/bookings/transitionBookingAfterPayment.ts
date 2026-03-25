import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/inApp";
import { resolveBookingParticipants } from "@/lib/notifications/sendNotificationEmail";
import { setBookingStatus } from "@/lib/bookings/setBookingStatus";
import { sendSms } from "@/lib/sms/sendSms";
import { getUserPhone } from "@/lib/user/getUserPhone";

const MIN_LEAD_TIME_MINUTES = 30;
const DEFAULT_MIN_ADVANCE_HOURS = 24;

export type PaymentTransitionLogCtx = {
  source: string;
  eventId?: string;
  eventType?: string;
  livemode?: boolean;
};

function formatHourZurich(dt: Date) {
  try {
    return new Intl.DateTimeFormat("fr-CH", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
}

async function notifyPendingAcceptance(req: NextRequest, bookingId: string) {
  try {
    const participants = await resolveBookingParticipants(bookingId);
    if (!participants) return;

    if (participants.sitter?.id) {
      try {
        await createNotification({
          userId: participants.sitter.id,
          type: "newBookingRequest",
          title: "Nouvelle demande de réservation",
          body: null,
          entityId: bookingId,
          url: "/host/requests",
          idempotencyKey: `newBookingRequest:${bookingId}:pending_acceptance`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[payment-transition] in-app notification failed (newBookingRequest)", err);
      }
    }

    if (participants.owner?.id) {
      try {
        await createNotification({
          userId: participants.owner.id,
          type: "paymentReceived",
          title: "Paiement reçu",
          body: null,
          entityId: bookingId,
          url: `/account/bookings?id=${encodeURIComponent(bookingId)}`,
          idempotencyKey: `paymentReceived:${bookingId}:payment_received`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[payment-transition] in-app notification failed (paymentReceived owner)", err);
      }
    }

    if (participants.sitter?.id) {
      try {
        await createNotification({
          userId: participants.sitter.id,
          type: "paymentReceived",
          title: "Paiement reçu",
          body: null,
          entityId: bookingId,
          url: "/host/requests",
          idempotencyKey: `paymentReceived:${bookingId}:payment_received`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[payment-transition] in-app notification failed (paymentReceived sitter)", err);
      }
    }
  } catch (err) {
    console.error("[payment-transition] notifyPendingAcceptance failed", { bookingId, err });
  }
}

async function notifyLastMinuteConfirmed(req: NextRequest, bookingId: string) {
  try {
    const participants = await resolveBookingParticipants(bookingId);
    if (!participants) return;

    if (participants.owner?.id) {
      try {
        await createNotification({
          userId: participants.owner.id,
          type: "paymentReceived",
          title: "Paiement reçu",
          body: null,
          entityId: bookingId,
          url: `/account/bookings?id=${encodeURIComponent(bookingId)}`,
          idempotencyKey: `paymentReceived:${bookingId}:payment_received`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[payment-transition] in-app notification failed (paymentReceived owner)", err);
      }

      try {
        await createNotification({
          userId: participants.owner.id,
          type: "bookingConfirmed",
          title: "Réservation confirmée",
          body: null,
          entityId: bookingId,
          url: `/account/bookings?id=${encodeURIComponent(bookingId)}`,
          idempotencyKey: `bookingConfirmed:${bookingId}:owner`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[payment-transition] in-app notification failed (bookingConfirmed owner)", err);
      }
    }

    if (participants.sitter?.id) {
      try {
        await createNotification({
          userId: participants.sitter.id,
          type: "paymentReceived",
          title: "Paiement reçu",
          body: null,
          entityId: bookingId,
          url: "/host/requests",
          idempotencyKey: `paymentReceived:${bookingId}:payment_received`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[payment-transition] in-app notification failed (paymentReceived sitter)", err);
      }

      try {
        await createNotification({
          userId: participants.sitter.id,
          type: "bookingConfirmed",
          title: "Réservation confirmée",
          body: null,
          entityId: bookingId,
          url: "/host/requests",
          idempotencyKey: `bookingConfirmed:${bookingId}:sitter`,
          metadata: { bookingId },
        });
      } catch (err) {
        console.error("[payment-transition] in-app notification failed (bookingConfirmed sitter)", err);
      }
    }
  } catch (err) {
    console.error("[payment-transition] notifyLastMinuteConfirmed failed", { bookingId, err });
  }
}

async function sendLastMinuteSmsIfNeeded(params: { bookingId: string; sitterUserId: string; startDate: Date }) {
  const { bookingId, sitterUserId } = params;

  const claimed = await (prisma as any).booking.updateMany({
    where: { id: bookingId, lastMinuteSmsSentAt: null },
    data: { lastMinuteSmsSentAt: new Date() },
  });
  if ((claimed?.count ?? 0) !== 1) {
    console.info("[payment-transition][sms] skip: already claimed or no row", { bookingId, source: "last-minute" });
    return;
  }

  try {
    const sitterUser = await prisma.user.findUnique({
      where: { id: sitterUserId },
      select: { id: true, phone: true, hostProfileJson: true },
    });
    const to = getUserPhone(sitterUser ?? { userId: sitterUserId });
    if (!to) {
      console.warn("[payment-transition][sms] missing sitter phone", { bookingId, userId: sitterUserId });
      return;
    }

    const hour = formatHourZurich(params.startDate);
    const body = `DogShift : nouvelle réservation de dernière minute confirmée (aujourd’hui ${hour}). Consulte les détails sur la plateforme.`;

    console.info("[payment-transition][sms] sending Vonage last-minute", { bookingId, sitterUserId });
    const res = await sendSms({ to, body });
    if (!res.ok) {
      console.warn("[payment-transition][sms] send failed", {
        bookingId,
        sitterUserId,
        error: res.error,
        skipped: res.skipped ?? false,
      });
    } else {
      console.info("[payment-transition][sms] sent ok", { bookingId });
    }
  } catch (err) {
    console.warn("[payment-transition][sms] send crashed", { bookingId, sitterUserId, err });
  }
}

/**
 * Same rules as POST /api/stripe/webhook markBookingPaid: PAID vs CONFIRMED from last-minute window
 * + SitterProfile.lastMinuteEnabled, then notifications + optional SMS.
 * Used by Stripe webhooks and by GET /api/account/bookings/[id] reconcile when webhooks are delayed (local dev).
 */
export async function transitionBookingAfterStripePaymentSuccess(
  req: NextRequest,
  bookingId: string,
  logCtx: PaymentTransitionLogCtx
) {
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, sitterId: true, service: true, startDate: true },
  });

  if (!booking?.id) {
    console.error("[payment-transition] booking not found", { bookingId, ...logCtx });
    return { ok: false as const, changed: false as const, error: "NOT_FOUND" as const };
  }

  const statusBefore = String(booking.status ?? "");

  const startDate =
    booking.startDate instanceof Date ? booking.startDate : booking.startDate ? new Date(booking.startDate) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    console.error("[payment-transition] missing startDate", { bookingId, ...logCtx });
    return { ok: false as const, changed: false as const, error: "MISSING_START_DATE" as const };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const startIso = startDate.toISOString();
  const deltaMs = startDate.getTime() - now;
  const deltaMinutes = deltaMs / (60 * 1000);
  const deltaHours = deltaMs / (60 * 60 * 1000);

  const minLeadMs = MIN_LEAD_TIME_MINUTES * 60 * 1000;
  const minAdvanceMs = DEFAULT_MIN_ADVANCE_HOURS * 60 * 60 * 1000;

  const sitterLastMinute = await (prisma as any).sitterProfile.findUnique({
    where: { sitterId: booking.sitterId },
    select: { lastMinuteEnabled: true },
  });
  const lastMinuteEnabled = Boolean(sitterLastMinute?.lastMinuteEnabled);

  const isLastMinuteWindow = Number.isFinite(deltaMs) && deltaMs >= minLeadMs && deltaMs < minAdvanceMs;
  const shouldAutoConfirm = isLastMinuteWindow && lastMinuteEnabled;
  const nextStatus = (shouldAutoConfirm ? "CONFIRMED" : "PAID") as "CONFIRMED" | "PAID";

  console.log("[payment-transition] last-minute decision", {
    ...logCtx,
    bookingId,
    statusBefore,
    service: booking.service ?? null,
    sitterId: booking.sitterId,
    nowIso,
    startIso,
    deltaMs: Math.round(deltaMs),
    deltaMinutes: Math.round(deltaMinutes * 100) / 100,
    deltaHours: Math.round(deltaHours * 1000) / 1000,
    minLeadMinutes: MIN_LEAD_TIME_MINUTES,
    maxAdvanceHours: DEFAULT_MIN_ADVANCE_HOURS,
    isLastMinuteWindow,
    lastMinuteEnabled,
    shouldAutoConfirm,
    nextStatus,
  });

  if (Number.isFinite(deltaMs) && deltaMs < minLeadMs) {
    console.warn("[payment-transition] booking start <30min relative to now", { bookingId, deltaMs, ...logCtx });
  }

  const res = await setBookingStatus(bookingId, nextStatus as any, { req });
  if (!res.ok) {
    console.error("[payment-transition] setBookingStatus failed", { bookingId, error: res.error, ...logCtx });
    return { ok: false as const, changed: false as const, error: res.error };
  }

  console.log("[payment-transition] setBookingStatus result", {
    ...logCtx,
    bookingId,
    statusBefore,
    changed: res.changed,
    previousStatus: "previousStatus" in res ? res.previousStatus : undefined,
    nextStatus: "nextStatus" in res ? res.nextStatus : undefined,
    requestedTarget: nextStatus,
  });

  if (res.ok && res.changed) {
    if (shouldAutoConfirm) {
      await notifyLastMinuteConfirmed(req, bookingId);

      try {
        const participants = await resolveBookingParticipants(bookingId);
        if (participants?.sitter?.id) {
          await sendLastMinuteSmsIfNeeded({ bookingId, sitterUserId: participants.sitter.id, startDate });
        } else {
          console.warn("[payment-transition][sms] skip: no sitter participant", { bookingId, ...logCtx });
        }
      } catch (err) {
        console.warn("[payment-transition][sms] side-effect crashed (best-effort)", { bookingId, err, ...logCtx });
      }
    } else {
      await notifyPendingAcceptance(req, bookingId);
    }
  }

  const targetStatusAfter =
    res.changed && "nextStatus" in res ? String(res.nextStatus) : statusBefore;
  return {
    ok: true as const,
    changed: res.changed,
    targetStatus: targetStatusAfter,
  };
}
