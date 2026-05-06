/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout, type EmailSummaryRow } from "@/lib/email/templates/layout";
import { buildTravelMapUrl } from "@/lib/travel/staticMap";
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

function displayNameFromHostProfileJson(hostProfileJson: unknown) {
  const raw = typeof hostProfileJson === "string" ? hostProfileJson : "";
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    const firstName = typeof parsed?.firstName === "string" ? parsed.firstName.trim() : "";
    return firstName || null;
  } catch {
    return null;
  }
}

async function resolveSenderDisplayName(senderUserId: string) {
  const u = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: {
      id: true,
      email: true,
      name: true,
      hostProfileJson: true,
      sitterProfile: { select: { displayName: true } },
    },
  });
  if (!u) return "Utilisateur DogShift";

  const sitterDisplayName =
    typeof (u as any)?.sitterProfile?.displayName === "string" ? String((u as any).sitterProfile.displayName).trim() : "";
  if (sitterDisplayName) return sitterDisplayName;

  const firstName = displayNameFromHostProfileJson((u as any).hostProfileJson);
  if (firstName) return firstName;

  const fullName = typeof (u as any).name === "string" ? String((u as any).name).trim() : "";
  if (fullName) return fullName;

  const email = typeof (u as any).email === "string" ? String((u as any).email).trim() : "";
  if (email) return email;

  return "Utilisateur DogShift";
}

async function resolveSitterEmailBySitterId(sitterId: string) {
  const sitter = await prisma.user.findFirst({
    where: { sitterId },
    select: { id: true, email: true, name: true },
  });
  return sitter?.email ? { id: sitter.id, email: sitter.email, name: sitter?.name ?? null } : null;
}

function formatMoney(amount: unknown, currency: unknown) {
  const a = typeof amount === "number" && Number.isFinite(amount) ? amount : NaN;
  const c = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "CHF";
  if (!Number.isFinite(a)) return "";
  return `${(a / 100).toFixed(2)} ${c}`;
}

function formatDateTime(value: unknown) {
  const d = value instanceof Date ? value : value ? new Date(String(value)) : null;
  if (!d) return "";
  const ts = d.getTime();
  if (!Number.isFinite(ts)) return "";
  try {
    return new Intl.DateTimeFormat("fr-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

type TravelEmailData = {
  mapUrl: string;
  distanceKm: number;
  feeCents: number;
} | null;

type DogProfileData = {
  name: string;
  breed?: string | null;
  birthYear?: number | null;
  weightKg?: number | null;
  medications?: string | null;
  allergies?: string | null;
  vetContact?: string | null;
  behaviorNotes?: string | null;
  feedingNotes?: string | null;
  sitterInstructions?: string | null;
  photoUrl?: string | null;
} | null;

function buildDogProfileHtml(dog: DogProfileData): string {
  if (!dog) return "";
  const row = (label: string, value: string | null | undefined) => {
    if (!value || !value.trim()) return "";
    return `
      <tr>
        <td style="padding:6px 10px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#374151;vertical-align:top;white-space:nowrap;">${label}</td>
        <td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;vertical-align:top;">${value.trim().replace(/\n/g, "<br/>")}</td>
      </tr>`;
  };

  const age = dog.birthYear ? `${new Date().getFullYear() - dog.birthYear} ans (né en ${dog.birthYear})` : null;
  const weight = dog.weightKg ? `${dog.weightKg} kg` : null;

  const tableRows = [
    row("Race", dog.breed),
    row("Âge", age),
    row("Poids", weight),
    row("Médicaments", dog.medications),
    row("Allergies", dog.allergies),
    row("Vétérinaire", dog.vetContact),
    row("Comportement", dog.behaviorNotes),
    row("Alimentation", dog.feedingNotes),
    row("Instructions", dog.sitterInstructions),
  ].join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:16px;border-radius:12px;overflow:hidden;border:1px solid #e0e7ef;">
      <tr>
        <td colspan="2" style="padding:10px 14px;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#1e3a5f;">
          Fiche de ${dog.name}
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px 14px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            ${tableRows || '<tr><td style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">Aucune information supplémentaire.</td></tr>'}
          </table>
        </td>
      </tr>
      <tr><td colspan="2" style="height:10px;"></td></tr>
    </table>`;
}

async function resolveBookingEmailData(bookingId: string): Promise<{
  rows: EmailSummaryRow[];
  travel: TravelEmailData;
  dog: DogProfileData;
  ownerPhone: string | null;
  pickupAddress: string | null;
}> {
  const booking = await (prisma as any).booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      service: true,
      startDate: true,
      endDate: true,
      amount: true,
      currency: true,
      sitterId: true,
      locationMode: true,
      travelDistanceKm: true,
      travelFeeAmount: true,
      ownerLat: true,
      ownerLng: true,
      ownerAddress: true,
      ownerPhone: true,
      dogProfileId: true,
      selectedDog: {
        select: {
          name: true,
          breed: true,
          birthYear: true,
          weightKg: true,
          medications: true,
          allergies: true,
          vetContact: true,
          behaviorNotes: true,
          feedingNotes: true,
          sitterInstructions: true,
          photoUrl: true,
        },
      },
    },
  });

  if (!booking) return { rows: [{ label: "Référence", value: bookingId }], travel: null, dog: null, ownerPhone: null, pickupAddress: null };

  const rows: EmailSummaryRow[] = [];
  const service = typeof booking.service === "string" && booking.service.trim() ? booking.service.trim() : "";
  const start = formatDateTime(booking.startDate);
  const end = formatDateTime(booking.endDate);
  const currency = typeof booking.currency === "string" ? booking.currency : "CHF";

  const travelFee =
    typeof booking.travelFeeAmount === "number" && Number.isFinite(booking.travelFeeAmount)
      ? booking.travelFeeAmount
      : 0;
  const serviceSubtotal =
    typeof booking.amount === "number" && Number.isFinite(booking.amount) ? booking.amount - travelFee : null;
  const totalAmount = typeof booking.amount === "number" && Number.isFinite(booking.amount) ? booking.amount : null;

  if (service) rows.push({ label: "Service", value: service });
  if (start) rows.push({ label: "Début", value: start });
  if (end) rows.push({ label: "Fin", value: end });

  const pickupAddress = booking.locationMode === "AT_OWNER" && typeof booking.ownerAddress === "string" && booking.ownerAddress.trim()
    ? booking.ownerAddress.trim()
    : null;

  if (pickupAddress) rows.push({ label: "Lieu de prise en charge", value: pickupAddress });

  if (booking.locationMode === "AT_OWNER" && travelFee > 0 && serviceSubtotal !== null) {
    rows.push({ label: "Sous-total service", value: formatMoney(serviceSubtotal, currency) });
    rows.push({ label: "Frais de déplacement", value: formatMoney(travelFee, currency) });
  }
  if (totalAmount !== null) rows.push({ label: "Total", value: formatMoney(totalAmount, currency) });
  rows.push({ label: "Référence", value: String(booking.id) });

  // Build static map if travel booking with both sets of coordinates
  let travel: TravelEmailData = null;
  if (
    booking.locationMode === "AT_OWNER" &&
    typeof booking.ownerLat === "number" &&
    typeof booking.ownerLng === "number" &&
    booking.sitterId
  ) {
    try {
      const sitterProfile = await (prisma as any).sitterProfile.findUnique({
        where: { sitterId: booking.sitterId },
        select: { lat: true, lng: true },
      });
      if (
        sitterProfile &&
        typeof sitterProfile.lat === "number" &&
        typeof sitterProfile.lng === "number"
      ) {
        const mapUrl = buildTravelMapUrl({
          sitterLat: sitterProfile.lat,
          sitterLng: sitterProfile.lng,
          ownerLat: booking.ownerLat,
          ownerLng: booking.ownerLng,
        });
        const distanceKm =
          typeof booking.travelDistanceKm === "number" && Number.isFinite(booking.travelDistanceKm)
            ? booking.travelDistanceKm
            : 0;
        if (mapUrl) {
          travel = { mapUrl, distanceKm, feeCents: travelFee };
        }
      }
    } catch {
      // non-critical — email sends without map
    }
  }

  const ownerPhone = typeof booking.ownerPhone === "string" && booking.ownerPhone.trim() ? booking.ownerPhone.trim() : null;
  const dog: DogProfileData = booking.selectedDog ?? null;

  return { rows, travel, dog, ownerPhone, pickupAddress };
}

async function resolveBookingSummaryRows(bookingId: string): Promise<EmailSummaryRow[]> {
  const { rows } = await resolveBookingEmailData(bookingId);
  return rows;
}

async function resolveBookingRequestEmailData(bookingId: string): Promise<{
  rows: EmailSummaryRow[];
  extraHtml: string;
}> {
  const { rows, travel, dog, ownerPhone } = await resolveBookingEmailData(bookingId);

  // Add owner phone to summary rows for the sitter
  const sitterRows: EmailSummaryRow[] = ownerPhone
    ? [...rows.slice(0, -1), { label: "Tél. propriétaire", value: ownerPhone }, rows[rows.length - 1]!]
    : rows;

  const extraHtml = buildTravelMapExtraHtml(travel) + buildDogProfileHtml(dog);
  return { rows: sitterRows, extraHtml };
}

function buildTravelMapExtraHtml(travel: TravelEmailData): string {
  if (!travel?.mapUrl) return "";
  const distStr = travel.distanceKm.toFixed(1);
  const feeStr = `CHF ${(travel.feeCents / 100).toFixed(2)}`;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="border-radius:12px;overflow:hidden;border:1px solid #e0e7ff;">
          <img
            src="${travel.mapUrl}"
            alt="Carte du trajet"
            width="516"
            style="display:block;width:100%;max-width:516px;height:auto;border-radius:12px 12px 0 0;"
          />
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f5f3ff;border-top:1px solid #e0e7ff;">
            <tr>
              <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;">
                <span style="color:#4f46e5;font-weight:700;">&#x1F4CD; ${distStr} km</span>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                <span style="color:#059669;font-weight:700;">Frais : ${feeStr}</span>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                <span style="color:#6b7280;">Le sitter se déplace chez vous</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export type NotificationPayload =
  | { kind: "newMessage"; conversationId: string; messagePreview: string; fromName: string }
  | { kind: "bookingRequest"; bookingId: string }
  | { kind: "bookingConfirmed"; bookingId: string }
  | { kind: "paymentReceived"; bookingId: string }
  | { kind: "bookingReminder"; bookingId: string; startsAtIso: string }
  | { kind: "bookingCancelled"; bookingId: string; dashboard: "account" | "host" }
  | { kind: "bookingRefunded"; bookingId: string; dashboard: "account" | "host" }
  | { kind: "bookingAutoExpiredRefunded"; bookingId: string; deadlineHours: number }
  | { kind: "bookingRefundFailed"; bookingId: string; dashboard: "account" | "host" };

async function resolveConversationLabel(conversationId: string) {
  try {
    const convo = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
      select: { bookingId: true },
    });
    const bookingId = typeof convo?.bookingId === "string" && convo.bookingId.trim() ? convo.bookingId.trim() : "";
    return bookingId ? `Réservation #${bookingId}` : "Conversation";
  } catch {
    return "Conversation";
  }
}

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
        return "Nouveau message sur DogShift";
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
        return payload.dashboard === "host" ? "Réservation annulée – DogShift" : "Remboursement effectué – DogShift";
      case "bookingAutoExpiredRefunded":
        return "Réservation expirée et remboursée – DogShift";
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

  const logoUrl = baseUrl ? `${baseUrl}/dogshift-logo.png` : "";

  const text = (() => {
    switch (payload.kind) {
      case "newMessage": {
        const url = baseUrl ? `${baseUrl}/account/messages?conversationId=${encodeURIComponent(payload.conversationId)}` : "";
        return (
          `Bonjour,

` +
          `Vous avez reçu un nouveau message sur DogShift.

` +
          (url ? `Voir la conversation : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "bookingRequest": {
        const url = bookingUrl(payload.bookingId, "host");
        return (
          `Bonjour,

` +
          `Tu as reçu une nouvelle demande de réservation.

` +
          (url ? `Voir la demande : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "bookingConfirmed": {
        const url = bookingUrl(payload.bookingId, "account");
        return (
          `Bonjour,

` +
          `Ta réservation a été confirmée.

` +
          (url ? `Voir la réservation : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "paymentReceived": {
        const url = bookingUrl(payload.bookingId, "account");
        return (
          `Bonjour,

` +
          `Le paiement a bien été reçu.

` +
          (url ? `Voir les détails : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "bookingReminder": {
        const url = bookingUrl(payload.bookingId, "account");
        return (
          `Bonjour,

` +
          `Petit rappel : une réservation approche (${payload.startsAtIso}).

` +
          (url ? `Voir la réservation : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "bookingCancelled": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        return (
          `Bonjour,

` +
          `Une réservation a été annulée.

` +
          (url ? `Voir la réservation : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "bookingRefunded": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        if (payload.dashboard === "host") {
          return (
            `Bonjour,

` +
            `Une réservation a été annulée.
` +
            `Le remboursement du propriétaire a été traité conformément aux conditions applicables.

` +
            (url ? `Voir les détails de la réservation : ${url}

` : "") +
            `— DogShift
`
          );
        }
        return (
          `Bonjour,

` +
          `Un remboursement a été effectué pour une réservation.

` +
          (url ? `Voir la réservation : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "bookingAutoExpiredRefunded": {
        const url = bookingUrl(payload.bookingId, "account");
        return (
          `Bonjour,

` +
          `La réservation n’a pas été acceptée à temps par le dogsitter.
` +
          `Comme le début du service approche à moins de ${payload.deadlineHours}h, la réservation a été annulée automatiquement et le remboursement a été déclenché.

` +
          (url ? `Voir la réservation : ${url}

` : "") +
          `— DogShift
`
        );
      }
      case "bookingRefundFailed": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        return (
          `Bonjour,

` +
          `Le remboursement d’une réservation a échoué.

` +
          (url ? `Voir la réservation : ${url}

` : "") +
          `— DogShift
`
        );
      }
      default:
        return `Bonjour,

Notification DogShift.

— DogShift
`;
    }
  })();

  const html = await (async () => {
    switch (payload.kind) {
      case "newMessage": {
        const recipientHasSitterProfile = Boolean(
          await prisma.sitterProfile.findUnique({ where: { userId: recipientUserId }, select: { userId: true } })
        );
        const conversationUrl = baseUrl
          ? recipientHasSitterProfile
            ? `${baseUrl}/host/messages/${encodeURIComponent(payload.conversationId)}`
            : `${baseUrl}/account/messages?conversationId=${encodeURIComponent(payload.conversationId)}`
          : "";
        const conversationLabel = await resolveConversationLabel(payload.conversationId);

        const rows: EmailSummaryRow[] = [
          { label: "De", value: payload.fromName || "Utilisateur" },
          { label: "Conversation", value: conversationLabel },
        ];
        return renderEmailLayout({
          logoUrl,
          title: "Nouveau message",
          subtitle: "Vous avez reçu un nouveau message sur DogShift.",
          summaryRows: rows,
          ctaLabel: conversationUrl ? "Voir la conversation" : undefined,
          ctaUrl: conversationUrl || undefined,
          secondaryLinkLabel: baseUrl ? "Ouvrir DogShift" : undefined,
          secondaryLinkUrl: baseUrl ? `${baseUrl}/account` : undefined,
          footerLinks: baseUrl ? [{ label: "Gérer mes notifications", url: `${baseUrl}/account/settings` }] : undefined,
        }).html;
      }
      case "bookingRequest": {
        const url = bookingUrl(payload.bookingId, "host");
        const { rows, extraHtml } = await resolveBookingRequestEmailData(payload.bookingId);
        return renderEmailLayout({
          logoUrl,
          title: "Nouvelle demande de réservation",
          subtitle: "Tu as reçu une nouvelle demande.",
          summaryRows: rows,
          extraHtml: extraHtml || undefined,
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "bookingConfirmed": {
        const url = bookingUrl(payload.bookingId, "account");
        const { rows, travel } = await resolveBookingEmailData(payload.bookingId);
        return renderEmailLayout({
          logoUrl,
          title: "Réservation confirmée",
          subtitle: "Ta réservation a été confirmée.",
          summaryRows: rows,
          extraHtml: buildTravelMapExtraHtml(travel),
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "paymentReceived": {
        const url = bookingUrl(payload.bookingId, "account");
        const { rows, travel } = await resolveBookingEmailData(payload.bookingId);
        return renderEmailLayout({
          logoUrl,
          title: "Paiement reçu",
          subtitle: "Le paiement a bien été reçu.",
          summaryRows: rows,
          extraHtml: buildTravelMapExtraHtml(travel),
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "bookingReminder": {
        const url = bookingUrl(payload.bookingId, "account");
        const rows = await resolveBookingSummaryRows(payload.bookingId);
        const starts = payload.startsAtIso ? formatDateTime(payload.startsAtIso) : "";
        const nextRows = starts ? [{ label: "Début", value: starts }, ...rows.filter((r) => r.label !== "Début") ] : rows;
        return renderEmailLayout({
          logoUrl,
          title: "Rappel de réservation",
          subtitle: "Une réservation approche.",
          summaryRows: nextRows,
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "bookingCancelled": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        const rows = await resolveBookingSummaryRows(payload.bookingId);
        return renderEmailLayout({
          logoUrl,
          title: "Réservation annulée",
          subtitle: "Une réservation a été annulée.",
          summaryRows: rows,
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "bookingRefunded": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        const rows = await resolveBookingSummaryRows(payload.bookingId);
        return renderEmailLayout({
          logoUrl,
          title: payload.dashboard === "host" ? "Réservation annulée" : "Remboursement effectué",
          subtitle: payload.dashboard === "host"
            ? "Une réservation a été annulée. Le remboursement du propriétaire a été traité conformément aux conditions applicables."
            : "Le remboursement a été effectué.",
          summaryRows: rows,
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "bookingAutoExpiredRefunded": {
        const url = bookingUrl(payload.bookingId, "account");
        const rows = await resolveBookingSummaryRows(payload.bookingId);
        return renderEmailLayout({
          logoUrl,
          title: "Réservation expirée et remboursée",
          subtitle: `Le dogsitter n’a pas accepté à temps. La réservation a été annulée automatiquement et le remboursement a été déclenché avant J-${payload.deadlineHours}h.`,
          summaryRows: rows,
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "bookingRefundFailed": {
        const url = bookingUrl(payload.bookingId, payload.dashboard);
        const rows = await resolveBookingSummaryRows(payload.bookingId);
        return renderEmailLayout({
          logoUrl,
          title: "Remboursement impossible",
          subtitle: "Le remboursement a échoué. Notre équipe peut t’aider.",
          summaryRows: rows,
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      default:
        return renderEmailLayout({ logoUrl, title: "Notification", subtitle: "DogShift" }).html;
    }
  })();

  try {
    const res = await sendEmail({
      to: recipient.email,
      subject,
      text,
      html,
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

  const fromName = await resolveSenderDisplayName(params.senderUserId);

  if (conversation.ownerId === params.senderUserId) {
    const sitter = await resolveSitterEmailBySitterId(String(conversation.sitterId));
    if (!sitter) return null;
    return { recipientUserId: sitter.id, fromName };
  }

  const owner = await resolveUserEmail(String(conversation.ownerId));
  if (!owner) return null;
  return { recipientUserId: owner.id, fromName };
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
