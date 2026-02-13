import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  hasNotificationAlreadySent,
  markNotificationSent,
  shouldSendUserNotification,
  type NotificationKey,
} from "@/lib/notifications/prefs";

function nowIso() {
  return new Date().toISOString();
}

function baseUrlFromRequest(req?: NextRequest) {
  const appUrl = (process.env.APP_URL || "").trim();
  if (appUrl) return appUrl.replace(/\/$/, "");

  const publicAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (publicAppUrl) return publicAppUrl.replace(/\/$/, "");

  const env = (process.env.NEXTAUTH_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  if (!req) return "";

  const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0]?.trim() || "https";
  const host =
    (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim() ||
    (req.headers.get("host") || "").split(",")[0]?.trim() ||
    "";
  if (!host) return "";
  return `${proto}://${host}`;
}

async function resolveUserEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return user?.email ? { id: user.id, email: user.email, name: user?.name ?? null } : null;
}

async function resolveSitterEmailBySitterId(sitterId: string) {
  const sitter = await prisma.user.findFirst({
    where: { sitterId },
    select: { id: true, email: true, name: true },
  });
  return sitter?.email ? { id: sitter.id, email: sitter.email, name: sitter?.name ?? null } : null;
}

export type NotificationPayload =
  | { kind: "newMessage"; conversationId: string; messagePreview: string; fromName: string }
  | { kind: "bookingRequest"; bookingId: string }
  | { kind: "bookingConfirmed"; bookingId: string }
  | { kind: "paymentReceived"; bookingId: string }
  | { kind: "bookingReminder"; bookingId: string; startsAtIso: string }
  | { kind: "bookingCancelled"; bookingId: string; dashboard: "account" | "host" }
  | { kind: "bookingRefunded"; bookingId: string; dashboard: "account" | "host" }
  | { kind: "bookingRefundFailed"; bookingId: string; dashboard: "account" | "host" };

export async function sendNotificationEmail(params: {
  req?: NextRequest;
  recipientUserId: string;
  key: NotificationKey;
  entityId: string;
  payload: NotificationPayload;
}) {
  const { req, recipientUserId, key, entityId, payload } = params;

  const allow = await shouldSendUserNotification(recipientUserId, key);
  if (!allow) return { ok: true, skipped: true, reason: "PREF_OFF" as const };

  const already = await hasNotificationAlreadySent(recipientUserId, key, entityId);
  if (already) return { ok: true, skipped: true, reason: "ALREADY_SENT" as const };

  const recipient = await resolveUserEmail(recipientUserId);
  if (!recipient) return { ok: false, error: "RECIPIENT_NOT_FOUND" as const };

  const baseUrl = baseUrlFromRequest(req);
  const subject = (() => {
    switch (payload.kind) {
      case "newMessage":
        return "Nouveau message – DogShift";
      case "bookingRequest":
        return "Nouvelle demande de réservation – DogShift";
      case "bookingConfirmed":
        return "Réservation confirmée – DogShift";
      case "paymentReceived":
        return "Paiement reçu – DogShift";
      case "bookingReminder":
        return "Rappel de réservation – DogShift";
      case "bookingCancelled":
        return "Réservation annulée – DogShift";
      case "bookingRefunded":
        return "Remboursement effectué – DogShift";
      case "bookingRefundFailed":
        return "Remboursement impossible – DogShift";
      default:
        return "Notification – DogShift";
    }
  })();

  const bookingUrl = (bookingId: string, dashboard: "account" | "host") => {
    if (!baseUrl) return "";
    if (dashboard === "host") return `${baseUrl}/host/requests?id=${encodeURIComponent(bookingId)}`;
    return `${baseUrl}/account/bookings?id=${encodeURIComponent(bookingId)}`;
  };

  const text = (() => {
    switch (payload.kind) {
      case "newMessage": {
        const url = baseUrl ? `${baseUrl}/account/messages?conversationId=${encodeURIComponent(payload.conversationId)}` : "";
        return (
          `Bonjour,\n\n` +
          `Tu as reçu un nouveau message de ${payload.fromName}.\n\n` +
          `${payload.messagePreview}\n\n` +
          (url ? `Voir la conversation : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      case "bookingRequest": {
        const url = bookingUrl(payload.bookingId, "host");
        return (
          `Bonjour,\n\n` +
          `Tu as reçu une nouvelle demande de réservation.\n\n` +
          (url ? `Voir la demande : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      case "bookingConfirmed": {
        const url = bookingUrl(payload.bookingId, "account");
        return (
          `Bonjour,\n\n` +
          `Ta réservation a été confirmée.\n\n` +
          (url ? `Voir la réservation : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      case "paymentReceived": {
        const url = bookingUrl(payload.bookingId, "account");
        return (
          `Bonjour,\n\n` +
          `Le paiement a bien été reçu.\n\n` +
          (url ? `Voir les détails : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      case "bookingReminder": {
        const url = bookingUrl(payload.bookingId, "account");
        return (
          `Bonjour,\n\n` +
          `Petit rappel : une réservation approche (${payload.startsAtIso}).\n\n` +
          (url ? `Voir la réservation : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      case "bookingCancelled": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        return (
          `Bonjour,\n\n` +
          `Une réservation a été annulée.\n\n` +
          (url ? `Voir la réservation : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      case "bookingRefunded": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        return (
          `Bonjour,\n\n` +
          `Un remboursement a été effectué pour une réservation.\n\n` +
          (url ? `Voir la réservation : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      case "bookingRefundFailed": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        return (
          `Bonjour,\n\n` +
          `Le remboursement d’une réservation a échoué.\n\n` +
          (url ? `Voir la réservation : ${url}\n\n` : "") +
          `— DogShift\n`
        );
      }
      default:
        return `Bonjour,\n\nNotification DogShift.\n\n— DogShift\n`;
    }
  })();

  try {
    const res = await sendEmail({
      to: recipient.email,
      subject,
      text,
    });

    await markNotificationSent(recipientUserId, key, entityId, nowIso());

    return { ok: true, mode: res.mode };
  } catch (err) {
    console.error("[notifications] send failed", { key, recipientUserId, entityId, err });
    return { ok: false, error: "SEND_FAILED" as const };
  }
}

export async function resolveNotificationRecipientForConversation(params: {
  conversationId: string;
  senderUserId: string;
}) {
  const conversation = await (prisma as any).conversation.findUnique({
    where: { id: params.conversationId },
    select: { id: true, ownerId: true, sitterId: true },
  });

  if (!conversation) return null;

  if (conversation.ownerId === params.senderUserId) {
    const sitter = await resolveSitterEmailBySitterId(String(conversation.sitterId));
    if (!sitter) return null;
    return { recipientUserId: sitter.id, fromName: "Client" };
  }

  const owner = await resolveUserEmail(String(conversation.ownerId));
  if (!owner) return null;
  return { recipientUserId: owner.id, fromName: "Dogsitter" };
}

export async function resolveBookingParticipants(bookingId: string) {
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, sitterId: true, startDate: true, status: true },
  });

  if (!booking) return null;

  const owner = await resolveUserEmail(String(booking.userId));
  const sitter = await resolveSitterEmailBySitterId(String(booking.sitterId));

  return {
    bookingId: String(booking.id),
    status: String(booking.status ?? ""),
    startsAtIso: booking.startDate instanceof Date ? booking.startDate.toISOString() : booking.startDate ? new Date(booking.startDate).toISOString() : "",
    owner,
    sitter,
  };
}
