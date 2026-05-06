/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderEmailLayout, type EmailSummaryRow } from "@/lib/email/templates/layout";
import { buildTravelMapUrl } from "@/lib/travel/staticMap";
import { getSitterReviewSnapshot } from "@/lib/sitterReviews";
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

function formatShortDate(value: unknown): string {
  const d = value instanceof Date ? value : value ? new Date(String(value)) : null;
  if (!d || !Number.isFinite(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("fr-CH", {
      timeZone: "Europe/Zurich",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function formatCents(cents: number | undefined, currency?: string): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "";
  return `${(cents / 100).toFixed(2)} ${(currency || "CHF").toUpperCase()}`;
}

export function computeEligibleRefund(prestationStart: Date | null, cancellationTime: Date): boolean {
  if (!prestationStart) return true;
  return (prestationStart.getTime() - cancellationTime.getTime()) > 24 * 60 * 60 * 1000;
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

export type SitterEmailData = {
  name: string;
  avatarUrl: string | null;
  rating: number | null;
};

async function resolveBookingEmailData(bookingId: string): Promise<{
  rows: EmailSummaryRow[];
  travel: TravelEmailData;
  dog: DogProfileData;
  ownerPhone: string | null;
  pickupAddress: string | null;
  sitter: SitterEmailData | null;
  startDate: Date | null;
  amountCents: number | null;
  currency: string;
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

  if (!booking) return { rows: [{ label: "Référence", value: bookingId }], travel: null, dog: null, ownerPhone: null, pickupAddress: null, sitter: null, startDate: null, amountCents: null, currency: "CHF" };

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

  let travel: TravelEmailData = null;
  let sitter: SitterEmailData | null = null;
  if (booking.sitterId) {
    try {
      const sitterProfile = await (prisma as any).sitterProfile.findUnique({
        where: { sitterId: booking.sitterId },
        select: { lat: true, lng: true, displayName: true, avatarUrl: true },
      });
      if (sitterProfile) {
        const reviewSnapshot = await getSitterReviewSnapshot(booking.sitterId);
        sitter = {
          name: sitterProfile.displayName || "Sitter",
          avatarUrl: sitterProfile.avatarUrl || null,
          rating: reviewSnapshot.averageRating,
        };

        if (
          booking.locationMode === "AT_OWNER" &&
          typeof booking.ownerLat === "number" &&
          typeof booking.ownerLng === "number" &&
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
      }
    } catch {
      // non-critical — email sends without map/sitter profile
    }
  }

  const ownerPhone = typeof booking.ownerPhone === "string" && booking.ownerPhone.trim() ? booking.ownerPhone.trim() : null;
  const dog: DogProfileData = booking.selectedDog ?? null;

  const rawStartDate = booking.startDate instanceof Date ? booking.startDate : booking.startDate ? new Date(String(booking.startDate)) : null;
  const rawAmountCents = typeof booking.amount === "number" && Number.isFinite(booking.amount) ? booking.amount : null;

  return { rows, travel, dog, ownerPhone, pickupAddress, sitter, startDate: rawStartDate, amountCents: rawAmountCents, currency };
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

function buildReminderExtraHtml(
  sitter: SitterEmailData | null,
  travel: TravelEmailData | null,
  baseUrl: string,
  bookingId: string
): string {
  const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
  const messagesUrl = baseUrl ? `${baseUrl}/account/messages` : "#";
  const cancelUrl = baseUrl ? `${baseUrl}/account/bookings?id=${encodeURIComponent(bookingId)}` : "#";

  let sitterHtml = "";
  if (sitter) {
    const avatar = sitter.avatarUrl
      ? `<img src="${sitter.avatarUrl}" width="48" height="48" alt="${sitter.name}" style="display:block;border-radius:24px;border:1px solid #e2e8f0;object-fit:cover;" />`
      : `<div style="width:48px;height:48px;border-radius:24px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:center;line-height:48px;color:#64748b;font-size:18px;font-weight:700;">${sitter.name.charAt(0).toUpperCase()}</div>`;
    
    const ratingHtml = sitter.rating !== null
      ? `<div style="color:#eab308;font-size:13px;font-weight:600;margin-top:2px;">★ ${sitter.rating.toFixed(1)}</div>`
      : `<div style="color:#94a3b8;font-size:12px;margin-top:2px;">Nouveau sitter</div>`;

    sitterHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;margin-bottom:16px;">
        <tr>
          <td valign="middle" style="width:56px;">${avatar}</td>
          <td valign="middle" style="font-family:${FF};">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${sitter.name}</div>
            ${ratingHtml}
          </td>
        </tr>
      </table>
    `;
  }

  const mapHtml = travel ? buildTravelMapExtraHtml(travel) : "";

  const checklistItems = [
    "Préparer la laisse, le harnais et un sac à déjections",
    "Avoir de l'eau fraîche disponible",
    "Indiquer au sitter les habitudes ou consignes particulières",
    "Prévoir les clés ou code d'accès si remise en main propre impossible"
  ];

  const checkIcon = `<span style="color:#10b981;font-weight:bold;font-size:14px;display:inline-block;width:20px;">✓</span>`;
  const checklistHtml = `
    <div style="margin-top:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
      <h3 style="margin:0 0 14px;font-family:${FF};font-size:14px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Avant l'arrivée du sitter</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${checklistItems.map(item => `
          <tr>
            <td valign="top" style="padding:4px 0;width:24px;">${checkIcon}</td>
            <td valign="top" style="padding:4px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;">${item}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;

  const contactHtml = `
    <div style="margin-top:24px;text-align:center;font-family:${FF};">
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:12px;">Une question de dernière minute ?</div>
      <a href="${messagesUrl}" style="display:inline-block;background:#f1f5f9;color:#0f172a;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;border:1px solid #e2e8f0;">Contacter ${sitter?.name || "le sitter"}</a>
      <div style="margin-top:16px;">
        <a href="${cancelUrl}" style="color:#64748b;text-decoration:underline;font-size:12px;">Modifier ou annuler</a>
      </div>
    </div>
  `;

  return sitterHtml + mapHtml + checklistHtml + contactHtml;
}

function buildTravelMapExtraHtml(travel: TravelEmailData): string {
  if (!travel?.mapUrl) return "";
  const distStr = travel.distanceKm.toFixed(1);
  const feeStr = `CHF ${(travel.feeCents / 100).toFixed(2)}`;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:18px;">
      <tr>
        <td style="padding:0;">
          <img
            src="${travel.mapUrl}"
            alt="Carte du trajet"
            width="516"
            style="display:block;width:100%;max-width:516px;height:auto;border-radius:12px;"
          />
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#475569;">
          <strong style="color:#4f46e5;">${distStr} km</strong>
          &nbsp;·&nbsp;
          <span style="color:#059669;font-weight:600;">Frais : ${feeStr}</span>
          &nbsp;·&nbsp;
          <span style="color:#94a3b8;">Le sitter se déplace chez vous</span>
        </td>
      </tr>
    </table>
  `;
}

// ── Cancellation / Refund email helpers ──────────────────────────────────────

const CANCEL_FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";

function buildCancellationPolicyHtml(
  eligibleRefund: boolean,
  amountCents: number | undefined,
  sitterName: string | undefined,
  currency?: string,
): string {
  const amount = formatCents(amountCents, currency);

  if (eligibleRefund) {
    return `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
        <tr>
          <td style="padding:18px 24px;">
            <div style="font-family:${CANCEL_FF};font-size:14px;line-height:22px;color:#15803d;font-weight:600;">
              ✅ Tu seras remboursé(e) intégralement${amount ? ` de ${amount}` : ""}.
            </div>
            <div style="margin-top:6px;font-family:${CANCEL_FF};font-size:13px;line-height:20px;color:#475569;">
              Le remboursement apparaîtra sur ton compte sous 5 à 10 jours ouvrés.
            </div>
          </td>
        </tr>
      </table>`;
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;background:#fefce8;border:1px solid #fde68a;border-radius:12px;">
      <tr>
        <td style="padding:18px 24px;">
          <div style="font-family:${CANCEL_FF};font-size:14px;line-height:22px;color:#92400e;font-weight:600;">
            ⚠️ Annulation à moins de 24h du début de la prestation
          </div>
          <div style="margin-top:6px;font-family:${CANCEL_FF};font-size:13px;line-height:20px;color:#475569;">
            ${amount ? `Le montant de ${amount} reste acquis à ${sitterName || "le sitter"}.` : `Le montant reste acquis à ${sitterName || "le sitter"}.`}
            Conformément à nos conditions générales, aucun remboursement n'est possible pour les annulations effectuées moins de 24 heures avant le début de la prestation.
          </div>
        </td>
      </tr>
    </table>`;
}

function buildRefundInfoHtml(params: {
  amountCents?: number;
  currency?: string;
  cardBrand?: string;
  cardLast4?: string;
  stripeRefundId?: string;
}): string {
  const amount = formatCents(params.amountCents, params.currency);
  const cardInfo = params.cardBrand && params.cardLast4
    ? `${params.cardBrand} •••• ${params.cardLast4}`
    : null;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
      <tr>
        <td style="padding:20px 24px;">
          ${amount ? `<div style="font-family:${CANCEL_FF};font-size:28px;font-weight:800;color:#15803d;margin-bottom:8px;">${amount}</div>` : ""}
          ${cardInfo ? `<div style="font-family:${CANCEL_FF};font-size:13px;color:#475569;margin-bottom:4px;">💳 ${cardInfo}</div>` : ""}
          <div style="font-family:${CANCEL_FF};font-size:13px;color:#475569;margin-bottom:4px;">📅 Remboursement initié le ${formatShortDate(new Date())}</div>
          <div style="font-family:${CANCEL_FF};font-size:13px;color:#475569;">⏱ Délai estimé : 5 à 10 jours ouvrés</div>
          ${params.stripeRefundId ? `<div style="margin-top:8px;font-family:Menlo,Consolas,monospace;font-size:11px;color:#94a3b8;">Réf. ${params.stripeRefundId}</div>` : ""}
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:14px 20px;">
          <div style="font-family:${CANCEL_FF};font-size:13px;line-height:20px;color:#475569;">
            🛡️ <strong style="color:#0f172a;">Paiement sécurisé</strong> — Ton remboursement est traité via Stripe, le même prestataire de paiement utilisé par des millions de sites.
          </div>
        </td>
      </tr>
    </table>`;
}

function buildAutoExpiredExplanationHtml(deadlineHours: number): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
      <tr>
        <td style="padding:18px 24px;">
          <div style="font-family:${CANCEL_FF};font-size:14px;line-height:22px;color:#1e40af;font-weight:600;">
            ℹ️ Que s'est-il passé ?
          </div>
          <div style="margin-top:6px;font-family:${CANCEL_FF};font-size:13px;line-height:20px;color:#475569;">
            Chaque sitter dispose de ${deadlineHours}h pour accepter une demande de réservation.
            Comme ce délai a été dépassé, ta réservation a été automatiquement annulée et ton remboursement déclenché.
          </div>
        </td>
      </tr>
    </table>`;
}

function buildRefundFailedExplanationHtml(failureReason?: string): string {
  const reasonMap: Record<string, string> = {
    expired_or_canceled_card: "La carte utilisée pour le paiement a expiré ou a été annulée.",
    insufficient_funds: "Le remboursement n'a pas pu être crédité (fonds insuffisants ou compte clôturé).",
    lost_card: "La carte utilisée a été déclarée perdue.",
    stolen_card: "La carte utilisée a été déclarée volée.",
    charge_for_pending_refund_disputed: "Un litige est en cours sur cette transaction.",
  };
  const readableReason = (failureReason && reasonMap[failureReason]) || failureReason
    || "Une erreur technique est survenue lors du traitement de ton remboursement.";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;background:#fefce8;border:1px solid #fde68a;border-radius:12px;">
      <tr>
        <td style="padding:18px 24px;">
          <div style="font-family:${CANCEL_FF};font-size:14px;line-height:22px;color:#92400e;font-weight:600;">
            ⚠️ Détail du problème
          </div>
          <div style="margin-top:6px;font-family:${CANCEL_FF};font-size:13px;line-height:20px;color:#475569;">
            ${readableReason}
          </div>
          <div style="margin-top:10px;font-family:${CANCEL_FF};font-size:13px;line-height:20px;color:#475569;">
            Mets à jour tes informations de paiement ou contacte notre équipe pour que nous puissions relancer le remboursement.
          </div>
        </td>
      </tr>
    </table>`;
}

function buildSupportBlockHtml(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:16px 20px;text-align:center;">
          <div style="font-family:${CANCEL_FF};font-size:13px;line-height:20px;color:#475569;">
            Une question ? Notre équipe est là pour t'aider.<br/>
            <a href="mailto:support@dogshift.ch" style="color:#6366f1;text-decoration:none;font-weight:600;">support@dogshift.ch</a>
          </div>
        </td>
      </tr>
    </table>`;
}

export type NotificationPayload =
  | { kind: "newMessage"; conversationId: string; messagePreview: string; fromName: string }
  | { kind: "bookingRequest"; bookingId: string }
  | { kind: "bookingConfirmed"; bookingId: string }
  | { kind: "paymentReceived"; bookingId: string }
  | { kind: "bookingReminder"; bookingId: string; startsAtIso: string }
  | { kind: "bookingCancelled"; bookingId: string; dashboard: "account" | "host"; eligibleRefund?: boolean; cancelledBy?: "owner" | "sitter" | "system"; sitterName?: string; amountCents?: number; currency?: string }
  | { kind: "bookingRefunded"; bookingId: string; dashboard: "account" | "host"; amountCents?: number; currency?: string; cardBrand?: string; cardLast4?: string; stripeRefundId?: string }
  | { kind: "bookingAutoExpiredRefunded"; bookingId: string; deadlineHours: number; amountCents?: number; currency?: string; cardBrand?: string; cardLast4?: string; stripeRefundId?: string }
  | { kind: "bookingRefundFailed"; bookingId: string; dashboard: "account" | "host"; failureReason?: string; amountCents?: number; currency?: string };

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
        return "Action requise : remboursement impossible – DogShift";
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
        if (payload.dashboard === "host") {
          const url = bookingUrl(payload.bookingId, "host");
          return `Bonjour,\n\nUne réservation a été annulée.\n\n${url ? `Voir la réservation : ${url}\n\n` : ""}— DogShift\n`;
        }
        const cancelAmount = formatCents(payload.amountCents, payload.currency);
        const refundLine = payload.eligibleRefund !== false
          ? `Tu seras remboursé(e) intégralement${cancelAmount ? ` de ${cancelAmount}` : ""}. Le remboursement apparaîtra sous 5 à 10 jours ouvrés.`
          : `Cette annulation a lieu à moins de 24h du début de la prestation.${cancelAmount ? ` Le montant de ${cancelAmount} reste acquis à ${payload.sitterName || "le sitter"}.` : ""}`;
        const cancelSittersLink = baseUrl ? `${baseUrl}/sitters` : "";
        return `Bonjour,\n\nTa réservation a été annulée.\n${refundLine}\n\n${cancelSittersLink ? `Trouver un autre sitter : ${cancelSittersLink}\n\n` : ""}— DogShift\n`;
      }
      case "bookingRefunded": {
        if (payload.dashboard === "host") {
          const hostRefundUrl = bookingUrl(payload.bookingId, "host");
          return `Bonjour,\n\nUne réservation a été annulée.\nLe remboursement du propriétaire a été traité conformément aux conditions applicables.\n\n${hostRefundUrl ? `Voir les détails de la réservation : ${hostRefundUrl}\n\n` : ""}— DogShift\n`;
        }
        const refundAmount = formatCents(payload.amountCents, payload.currency);
        const refundSittersUrl = baseUrl ? `${baseUrl}/sitters` : "";
        return `Bonjour,\n\n${refundAmount ? `Ton remboursement de ${refundAmount} est en route.` : "Ton remboursement est en route."}\nTout est réglé de notre côté. Le montant apparaîtra sur ton compte sous 5 à 10 jours ouvrés.\n\n${refundSittersUrl ? `Trouver un nouveau sitter : ${refundSittersUrl}\n\n` : ""}— DogShift\n`;
      }
      case "bookingAutoExpiredRefunded": {
        const expiredSittersUrl = baseUrl ? `${baseUrl}/sitters` : "";
        const expiredAmount = formatCents(payload.amountCents, payload.currency);
        return `Bonjour,\n\nLe sitter n’a pas répondu à temps.\nTa réservation a été automatiquement annulée et remboursée.${expiredAmount ? ` (${expiredAmount})` : ""}\nChaque sitter dispose de ${payload.deadlineHours}h pour accepter une demande. Comme ce délai a été dépassé, ton remboursement a été déclenché.\n\n${expiredSittersUrl ? `Trouver un sitter disponible : ${expiredSittersUrl}\n\n` : ""}— DogShift\n`;
      }
      case "bookingRefundFailed": {
        const settingsUrl = baseUrl ? `${baseUrl}/account/settings` : "";
        const failedAmount = formatCents(payload.amountCents, payload.currency);
        return `Bonjour,\n\nNous n’avons pas pu te rembourser${failedAmount ? ` (${failedAmount})` : ""}.\nMets à jour tes informations de paiement ou contacte support@dogshift.ch.\n\n${settingsUrl ? `Mettre à jour mes informations : ${settingsUrl}\n\n` : ""}— DogShift\n`;
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
        const { rows, sitter, travel, dog } = await resolveBookingEmailData(payload.bookingId);
        
        const now = new Date();
        const start = payload.startsAtIso ? new Date(payload.startsAtIso) : now;
        const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
        const days = Math.max(1, Math.round(diffHours / 24));
        
        const timePrefix = days <= 1 ? "Demain" : `Dans ${days} jours`;
        const dogName = dog?.name || "votre chien";
        const sitterFirstName = sitter?.name?.split(" ")[0] || "le sitter";
        
        const title = `${timePrefix}, ${dogName} retrouve ${sitterFirstName} 🐾`;
        const subtitle = "Tout est prêt pour la prestation. Voici un petit récap pour ne rien oublier.";

        return renderEmailLayout({
          logoUrl,
          title,
          subtitle,
          summaryRows: rows,
          extraHtml: buildReminderExtraHtml(sitter, travel, baseUrl || "", payload.bookingId),
          ctaLabel: url ? "Voir la réservation" : undefined,
          ctaUrl: url || undefined,
        }).html;
      }
      case "bookingCancelled": {
        if (payload.dashboard === "host") {
          const hostUrl = bookingUrl(payload.bookingId, "host");
          const hostRows = await resolveBookingSummaryRows(payload.bookingId);
          return renderEmailLayout({
            logoUrl,
            title: "Réservation annulée",
            subtitle: "Une réservation a été annulée.",
            summaryRows: hostRows,
            ctaLabel: hostUrl ? "Voir la réservation" : undefined,
            ctaUrl: hostUrl || undefined,
          }).html;
        }
        const { rows, sitter, startDate } = await resolveBookingEmailData(payload.bookingId);
        const dateStr = formatShortDate(startDate);
        const sitterDisplayName = payload.sitterName || sitter?.name || "le sitter";

        const cancelledBySubtitle: Record<string, string> = {
          sitter: `${sitterDisplayName} n’est plus disponible pour cette date.`,
          owner: "Ton annulation a bien été prise en compte.",
          system: "Cette réservation a été annulée par notre équipe.",
        };
        const cancelSubtitle = cancelledBySubtitle[payload.cancelledBy || "owner"] || cancelledBySubtitle.owner;

        const policyHtml = buildCancellationPolicyHtml(
          payload.eligibleRefund !== false,
          payload.amountCents,
          sitterDisplayName,
          payload.currency,
        );

        return renderEmailLayout({
          logoUrl,
          title: dateStr ? `Ta réservation du ${dateStr} a été annulée` : "Ta réservation a été annulée",
          subtitle: cancelSubtitle,
          summaryRows: rows,
          extraHtml: policyHtml + buildSupportBlockHtml(),
          ctaLabel: baseUrl ? "Trouver un autre sitter" : undefined,
          ctaUrl: baseUrl ? `${baseUrl}/sitters` : undefined,
          secondaryLinkLabel: baseUrl ? "Voir mes réservations" : undefined,
          secondaryLinkUrl: baseUrl ? `${baseUrl}/account/bookings` : undefined,
          bannerImageUrl: "",
        }).html;
      }
      case "bookingRefunded": {
        if (payload.dashboard === "host") {
          const hostRefUrl = bookingUrl(payload.bookingId, "host");
          const hostRefRows = await resolveBookingSummaryRows(payload.bookingId);
          return renderEmailLayout({
            logoUrl,
            title: "Réservation annulée",
            subtitle: "Une réservation a été annulée. Le remboursement du propriétaire a été traité conformément aux conditions applicables.",
            summaryRows: hostRefRows,
            ctaLabel: hostRefUrl ? "Voir la réservation" : undefined,
            ctaUrl: hostRefUrl || undefined,
          }).html;
        }
        const refundedAmount = formatCents(payload.amountCents, payload.currency);
        const refundInfoHtml = buildRefundInfoHtml({
          amountCents: payload.amountCents,
          currency: payload.currency,
          cardBrand: payload.cardBrand,
          cardLast4: payload.cardLast4,
          stripeRefundId: payload.stripeRefundId,
        });

        return renderEmailLayout({
          logoUrl,
          heroLabel: "REMBOURSEMENT",
          title: refundedAmount ? `Ton remboursement de ${refundedAmount} est en route` : "Ton remboursement est en route",
          subtitle: "Tout est réglé de notre côté.",
          extraHtml: refundInfoHtml + buildSupportBlockHtml(),
          ctaLabel: baseUrl ? "Trouver un nouveau sitter" : undefined,
          ctaUrl: baseUrl ? `${baseUrl}/sitters` : undefined,
          secondaryLinkLabel: baseUrl ? "Voir mes réservations" : undefined,
          secondaryLinkUrl: baseUrl ? `${baseUrl}/account/bookings` : undefined,
          bannerImageUrl: "",
        }).html;
      }
      case "bookingAutoExpiredRefunded": {
        const expiredExplanationHtml = buildAutoExpiredExplanationHtml(payload.deadlineHours);
        const expiredRefundHtml = buildRefundInfoHtml({
          amountCents: payload.amountCents,
          currency: payload.currency,
          cardBrand: payload.cardBrand,
          cardLast4: payload.cardLast4,
          stripeRefundId: payload.stripeRefundId,
        });

        return renderEmailLayout({
          logoUrl,
          heroLabel: "EXPIRATION AUTOMATIQUE",
          title: "Le sitter n’a pas répondu à temps",
          subtitle: "Ta réservation a été automatiquement annulée et remboursée.",
          extraHtml: expiredExplanationHtml + expiredRefundHtml + buildSupportBlockHtml(),
          ctaLabel: baseUrl ? "Trouver un sitter disponible" : undefined,
          ctaUrl: baseUrl ? `${baseUrl}/sitters` : undefined,
          secondaryLinkLabel: baseUrl ? "Voir mes réservations" : undefined,
          secondaryLinkUrl: baseUrl ? `${baseUrl}/account/bookings` : undefined,
          bannerImageUrl: "",
        }).html;
      }
      case "bookingRefundFailed": {
        if (payload.dashboard === "host") {
          const hostFailUrl = bookingUrl(payload.bookingId, "host");
          const hostFailRows = await resolveBookingSummaryRows(payload.bookingId);
          return renderEmailLayout({
            logoUrl,
            title: "Remboursement impossible",
            subtitle: "Le remboursement a échoué. Notre équipe peut t’aider.",
            summaryRows: hostFailRows,
            ctaLabel: hostFailUrl ? "Voir la réservation" : undefined,
            ctaUrl: hostFailUrl || undefined,
          }).html;
        }
        const failedExplanationHtml = buildRefundFailedExplanationHtml(payload.failureReason);
        const failedAmountDisplay = formatCents(payload.amountCents, payload.currency);

        return renderEmailLayout({
          logoUrl,
          heroColor: "amber",
          heroLabel: "ACTION REQUISE",
          title: "Nous n’avons pas pu te rembourser",
          subtitle: "Quelques détails à mettre à jour pour finaliser ton remboursement.",
          extraHtml: (failedAmountDisplay
            ? `<div style="margin-top:16px;text-align:center;font-family:${CANCEL_FF};font-size:24px;font-weight:800;color:#d97706;">${failedAmountDisplay}</div>`
            : "") + failedExplanationHtml + buildSupportBlockHtml(),
          ctaLabel: baseUrl ? "Mettre à jour mes informations" : undefined,
          ctaUrl: baseUrl ? `${baseUrl}/account/settings` : undefined,
          secondaryLinkLabel: "Contacter le support",
          secondaryLinkUrl: "mailto:support@dogshift.ch",
          bannerImageUrl: "",
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
