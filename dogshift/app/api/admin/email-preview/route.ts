import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { render } from "@react-email/render";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email/sendEmail";
import { ActivationCodeEmail } from "@/lib/email/templates/activationCodeEmail";
import { ApplicationStatusEmail } from "@/lib/email/templates/applicationStatusEmail";
import { CommunicationsEmail } from "@/lib/email/templates/communicationsEmail";
import { PilotSitterApplicationConfirmationEmail } from "@/lib/email/templates/pilotSitterApplicationConfirmation";
import { renderLeadMagnetEmail } from "@/lib/email/templates/leadMagnetEmail";
import { renderZootherapieEmail } from "@/lib/email/templates/zootherapieEmail";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import { buildTravelMapUrl } from "@/lib/travel/staticMap";
import {
  renderNurturingStep1,
  renderNurturingStep2,
  renderNurturingStep3,
} from "@/lib/email/templates/leadNurturingEmail";

export const runtime = "nodejs";

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
const LOGO_URL = `${BASE_URL}/dogshift-logo.png`;

const MOCK_BOOKING_ROWS = [
  { label: "Service", value: "Promenade (1h)" },
  { label: "Début", value: "lun. 06 mai 2026, 10:00" },
  { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
  { label: "Total", value: "44.50 CHF" },
  { label: "Référence", value: "bk_preview_demo_2026" },
];

const MOCK_TRAVEL_BOOKING_ROWS = [
  { label: "Service", value: "Promenade (1h)" },
  { label: "Début", value: "lun. 06 mai 2026, 10:00" },
  { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
  { label: "Sous-total service", value: "35.00 CHF" },
  { label: "Frais de déplacement", value: "9.50 CHF" },
  { label: "Total", value: "44.50 CHF" },
  { label: "Référence", value: "bk_preview_demo_2026" },
];

// Mock coordinates: sitter near Lausanne centre, owner near Pully (~4.8 km)
const MOCK_SITTER = { lat: 46.519, lng: 6.6323 };
const MOCK_OWNER = { lat: 46.5094, lng: 6.6627 };

function buildMockTravelMapHtml(): string {
  const mapUrl = buildTravelMapUrl({
    sitterLat: MOCK_SITTER.lat,
    sitterLng: MOCK_SITTER.lng,
    ownerLat: MOCK_OWNER.lat,
    ownerLng: MOCK_OWNER.lng,
  });
  if (!mapUrl) return "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:18px;">
      <tr>
        <td style="padding:0;">
          <img
            src="${mapUrl}"
            alt="Carte du trajet"
            width="516"
            style="display:block;width:100%;max-width:516px;height:auto;border-radius:12px;"
          />
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#475569;">
          <strong style="color:#4f46e5;">4.8 km</strong>
          &nbsp;·&nbsp;
          <span style="color:#059669;font-weight:600;">Frais : CHF 9.50</span>
          &nbsp;·&nbsp;
          <span style="color:#94a3b8;">Le sitter se déplace chez vous</span>
        </td>
      </tr>
    </table>
  `;
}

function buildMockReminderHtml(): string {
  const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
  const messagesUrl = `${BASE_URL}/account/messages`;
  const cancelUrl = `${BASE_URL}/account/bookings`;

  const sitterHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;margin-bottom:16px;">
      <tr>
        <td valign="middle" style="width:56px;">
          <div style="width:48px;height:48px;border-radius:24px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:center;line-height:48px;color:#64748b;font-size:18px;font-weight:700;">C</div>
        </td>
        <td valign="middle" style="font-family:${FF};">
          <div style="font-size:15px;font-weight:700;color:#0f172a;">Camille R.</div>
          <div style="color:#eab308;font-size:13px;font-weight:600;margin-top:2px;">★ 4.9</div>
        </td>
      </tr>
    </table>
  `;

  const mapHtml = buildMockTravelMapHtml();

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
      <a href="${messagesUrl}" style="display:inline-block;background:#f1f5f9;color:#0f172a;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;border:1px solid #e2e8f0;">Contacter Camille</a>
      <div style="margin-top:16px;">
        <a href="${cancelUrl}" style="color:#64748b;text-decoration:underline;font-size:12px;">Modifier ou annuler</a>
      </div>
    </div>
  `;

  return sitterHtml + mapHtml + checklistHtml + contactHtml;
}

async function renderTemplate(template: string): Promise<{ html: string; subject: string } | null> {
  switch (template) {
    case "activation-code":
      return {
        subject: "Ton code d'activation DogShift",
        html: await render(
          ActivationCodeEmail({
            baseUrl: BASE_URL,
            firstName: "Sophie",
            activationCode: "DEMO-2026",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
        ),
      };

    case "application-high":
      return {
        subject: "Ta candidature DogShift — bonne nouvelle",
        html: await render(
          ApplicationStatusEmail({
            baseUrl: BASE_URL,
            firstName: "Sophie",
            lastName: "Martin",
            status: "HIGH",
            calendlyLink: "https://calendly.com/dogshift/entretien",
          }),
        ),
      };

    case "application-review":
      return {
        subject: "Ta candidature DogShift est à l'étude",
        html: await render(
          ApplicationStatusEmail({
            baseUrl: BASE_URL,
            firstName: "Sophie",
            lastName: "Martin",
            status: "REVIEW",
          }),
        ),
      };

    case "application-low":
      return {
        subject: "Ta candidature DogShift",
        html: await render(
          ApplicationStatusEmail({
            baseUrl: BASE_URL,
            firstName: "Sophie",
            lastName: "Martin",
            status: "LOW",
          }),
        ),
      };

    case "communications":
      return {
        subject: "Mise à jour de nos Conditions Générales d'Utilisation",
        html: await render(
          CommunicationsEmail({
            baseUrl: BASE_URL,
            firstName: "Sophie",
            subject: "Mise à jour de nos Conditions Générales d'Utilisation",
            customMessage:
              "Nous avons clarifié les conditions relatives aux annulations et au traitement de vos données personnelles.\n\nCes nouvelles conditions entrent en vigueur le 1er juin 2026.",
          }),
        ),
      };

    case "pilot-confirmation":
      return {
        subject: "Candidature reçue — DogShift",
        html: await render(
          PilotSitterApplicationConfirmationEmail({
            baseUrl: BASE_URL,
            firstName: "Sophie",
          }),
        ),
      };

    case "lead-magnet":
      return {
        subject: "Votre guide gratuit est prêt",
        html: renderLeadMagnetEmail({ baseUrl: BASE_URL }).html,
      };

    case "zootherapie":
      return {
        subject: "Votre évaluation bien-être personnalisée",
        html: renderZootherapieEmail({
          baseUrl: BASE_URL,
          prenom: "Sophie",
          titre: "Votre chien vous ressemble plus que vous ne le pensez",
          analyseRows: [
            {
              label: "Lien émotionnel",
              value:
                "La relation que vous décrivez avec Max révèle un attachement profond et sécurisant. Max a clairement trouvé en vous son point d'ancrage émotionnel.",
            },
            {
              label: "↓",
              value:
                "Ce type de lien favorise la réduction du stress chez les deux parties — humain et animal.",
            },
            {
              label: "Routine & structure",
              value:
                "Vos réponses indiquent une routine bien établie, ce que les chiens apprécient particulièrement pour leur équilibre.",
            },
            {
              label: "↓",
              value:
                "Une promenade à heure fixe, même courte, a plus de valeur qu'une longue balade imprévisible.",
            },
            {
              label: "Besoins de socialisation",
              value:
                "Max bénéficierait d'interactions régulières avec d'autres chiens pour enrichir son répertoire social.",
            },
          ],
          conseil:
            "Introduisez un rituel quotidien de 5 minutes de contact calme (caresses lentes, regard doux) en dehors des moments d'excitation. Cela renforce le lien et régule les émotions.",
          conclusion:
            "Votre attention et votre sensibilité envers Max sont de précieux atouts. Vous avez tous les fondements d'une relation épanouie — il s'agit maintenant de l'enrichir avec intention.",
        }).html,
      };

    case "new-message":
      return {
        subject: "Nouveau message sur DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Nouveau message",
          subtitle: "Vous avez reçu un nouveau message sur DogShift.",
          summaryRows: [
            { label: "De", value: "Marie Durand (Dog-sitter)" },
            { label: "Conversation", value: "Réservation #bk_preview_demo_2026" },
          ],
          ctaLabel: "Voir la conversation",
          ctaUrl: `${BASE_URL}/account/messages`,
          secondaryLinkLabel: "Ouvrir DogShift",
          secondaryLinkUrl: `${BASE_URL}/account`,
          footerLinks: [{ label: "Gérer mes notifications", url: `${BASE_URL}/account/settings` }],
        }).html,
      };

    case "booking-request": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const tipsHtml = `
        <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
          <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Nos conseils pour bien démarrer</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">💬</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Réponds rapidement</strong> — les propriétaires préfèrent les sitters réactifs. Un message dans l'heure fait toute la différence.</td></tr>
            <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📋</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Lis bien les détails</strong> — vérifie le service, les dates, la taille du chien et les éventuelles consignes avant d'accepter.</td></tr>
            <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">🤝</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Pose des questions</strong> — n'hésite pas à contacter le propriétaire pour clarifier les besoins de son chien.</td></tr>
          </table>
        </div>
        <div style="margin-top:16px;padding:14px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
          <div style="font-family:${FF};font-size:13px;line-height:20px;color:#166534;">
            ⏰ <strong>Pense à répondre sous 24h</strong> — passé ce délai, la demande pourra être automatiquement annulée.
          </div>
        </div>`;
      return {
        subject: "Nouvelle demande de réservation – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          audience: "sitter",
          title: "Nouvelle demande de réservation",
          subtitle: "Tu as reçu une nouvelle demande. Consulte les détails et réponds au propriétaire.",
          summaryRows: MOCK_BOOKING_ROWS,
          extraHtml: tipsHtml,
          ctaLabel: "Voir la demande",
          ctaUrl: `${BASE_URL}/host/requests`,
          secondaryLinkLabel: "Contacter le propriétaire",
          secondaryLinkUrl: `${BASE_URL}/host/messages`,
        }).html,
      };
    }

    case "booking-confirmed":
      return {
        subject: "Réservation confirmée – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Réservation confirmée",
          subtitle: "Ta réservation a été confirmée.",
          summaryRows: MOCK_TRAVEL_BOOKING_ROWS,
          extraHtml: buildMockTravelMapHtml(),
          ctaLabel: "Voir la réservation",
          ctaUrl: `${BASE_URL}/account/bookings`,
        }).html,
      };

    case "payment-received":
      return {
        subject: "Paiement reçu – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Paiement reçu",
          subtitle: "Le paiement a bien été reçu.",
          summaryRows: MOCK_TRAVEL_BOOKING_ROWS,
          extraHtml: buildMockTravelMapHtml(),
          ctaLabel: "Voir la réservation",
          ctaUrl: `${BASE_URL}/account/bookings`,
        }).html,
      };

    case "booking-reminder":
      return {
        subject: "Demain, Max retrouve Camille 🐾 – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Demain, Max retrouve Camille 🐾",
          subtitle: "Tout est prêt pour la prestation. Voici un petit récap pour ne rien oublier.",
          summaryRows: MOCK_TRAVEL_BOOKING_ROWS,
          extraHtml: buildMockReminderHtml(),
          ctaLabel: "Voir la réservation",
          ctaUrl: `${BASE_URL}/account/bookings`,
        }).html,
      };

    case "booking-cancelled":
      return {
        subject: "Réservation annulée – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Réservation annulée",
          subtitle: "Une réservation a été annulée.",
          summaryRows: MOCK_BOOKING_ROWS,
          ctaLabel: "Voir la réservation",
          ctaUrl: `${BASE_URL}/account/bookings`,
        }).html,
      };

    case "booking-refunded-owner":
      return {
        subject: "Remboursement effectué – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Remboursement effectué",
          subtitle: "Le remboursement a été effectué.",
          summaryRows: MOCK_BOOKING_ROWS,
          ctaLabel: "Voir la réservation",
          ctaUrl: `${BASE_URL}/account/bookings`,
        }).html,
      };

    case "booking-refunded-host": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const cancelInfoHtml = `
        <div style="margin-top:20px;padding:18px 20px;background:#fefce8;border:1px solid #fde68a;border-radius:12px;">
          <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400e;margin-bottom:8px;">Ce qui se passe maintenant</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            <tr><td valign="top" style="padding:5px 0;width:24px;font-size:14px;color:#92400e;">1.</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#78350f;">Le propriétaire a été remboursé selon les conditions d'annulation en vigueur.</td></tr>
            <tr><td valign="top" style="padding:5px 0;width:24px;font-size:14px;color:#92400e;">2.</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#78350f;">Le créneau correspondant est de nouveau disponible dans ton agenda.</td></tr>
            <tr><td valign="top" style="padding:5px 0;width:24px;font-size:14px;color:#92400e;">3.</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#78350f;">Aucune action n'est requise de ta part.</td></tr>
          </table>
        </div>
        <div style="margin-top:16px;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <div style="font-family:${FF};font-size:13px;line-height:20px;color:#475569;">
            💡 <strong>Astuce</strong> — vérifie que tes disponibilités sont à jour pour maximiser tes chances de recevoir de nouvelles demandes.
          </div>
        </div>`;
      return {
        subject: "Réservation annulée – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          audience: "sitter",
          title: "Réservation annulée",
          subtitle: "Le propriétaire a annulé la réservation. Le remboursement a été traité automatiquement.",
          summaryRows: MOCK_BOOKING_ROWS,
          extraHtml: cancelInfoHtml,
          ctaLabel: "Voir mes réservations",
          ctaUrl: `${BASE_URL}/host/requests`,
          secondaryLinkLabel: "Mettre à jour mes disponibilités",
          secondaryLinkUrl: `${BASE_URL}/host/availability`,
        }).html,
      };
    }

    case "booking-expired":
      return {
        subject: "Réservation expirée et remboursée – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Réservation expirée et remboursée",
          subtitle:
            "Le dogsitter n'a pas accepté à temps. La réservation a été annulée automatiquement et le remboursement a été déclenché avant J-24h.",
          summaryRows: MOCK_BOOKING_ROWS,
          ctaLabel: "Voir la réservation",
          ctaUrl: `${BASE_URL}/account/bookings`,
        }).html,
      };

    case "booking-refund-failed":
      return {
        subject: "Remboursement impossible – DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Remboursement impossible",
          subtitle: "Le remboursement a échoué. Notre équipe peut t'aider.",
          summaryRows: MOCK_BOOKING_ROWS,
          ctaLabel: "Voir la réservation",
          ctaUrl: `${BASE_URL}/account/bookings`,
        }).html,
      };

    case "welcome-owner":
      return {
        subject: "Bienvenue sur DogShift",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Bienvenue sur DogShift",
          subtitle: "Trouvez le dog-sitter idéal pour votre compagnon en toute sérénité.",
          summaryTitle: "Pourquoi choisir DogShift ?",
          summaryRows: [
            { label: "Sitters vérifiés", value: "Chaque sitter est sélectionné et vérifié manuellement par notre équipe" },
            { label: "Réservation simple", value: "Choisissez vos dates, confirmez en 2 clics — aucune complication" },
            { label: "Support réactif", value: "Notre équipe répond sous 24 h — Lausanne & Riviera vaudoise" },
          ],
          ctaLabel: "Trouver mon sitter →",
          ctaUrl: `${BASE_URL}/search`,
          footerText: "Vous recevez cet email car vous venez de créer un compte DogShift. DogShift • support@dogshift.ch",
          footerLinks: [
            { label: "dogshift.ch", url: BASE_URL },
            { label: "support@dogshift.ch", url: "mailto:support@dogshift.ch" },
          ],
        }).html,
      };

    case "review-request":
      return {
        subject: "Comment s'est passée votre réservation avec Marie ?",
        html: renderEmailLayout({
          logoUrl: LOGO_URL,
          title: "Noter votre sitter",
          subtitle: "Votre réservation avec Marie est maintenant terminée. Comment s'est-elle passée ?",
          summaryTitle: "Résumé",
          summaryRows: MOCK_BOOKING_ROWS,
          ctaLabel: "Laisser un avis",
          ctaUrl: `${BASE_URL}/account/bookings/bk_preview_demo_2026/review`,
          footerText: "Votre avis aide la communauté DogShift.",
        }).html,
      };

    case "nurturing-step1":
      return {
        subject: "Avez-vous eu le temps de lire votre guide ?",
        html: renderNurturingStep1({ baseUrl: BASE_URL, prenom: "Sophie" }).html,
      };

    case "nurturing-step2":
      return {
        subject: "Ce que disent les autres propriétaires de DogShift",
        html: renderNurturingStep2({ baseUrl: BASE_URL, prenom: "Sophie" }).html,
      };

    case "nurturing-step3":
      return {
        subject: "Votre chien mérite le meilleur sitter",
        html: renderNurturingStep3({ baseUrl: BASE_URL, prenom: "Sophie" }).html,
      };

    case "relance-owner":
      return {
        subject: "Sophie, votre chien mérite la meilleure attention",
        // Relance emails are fully AI-generated by Claude — this is a representative mock.
        html: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Relance owner</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;">
    Sophie, votre chien mérite la meilleure attention — finalisez votre réservation avec Camille.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f3f4f6;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="border-collapse:collapse;width:560px;max-width:560px;">
          <tr>
            <td style="padding:0 0 14px 0;text-align:center;">
              <img src="${LOGO_URL}" width="160" alt="DogShift" style="display:block;margin:0 auto;width:160px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:28px 28px 24px;border:1px solid #e5e7eb;">
              <p style="margin:0 0 16px;font-size:20px;font-weight:800;color:#111827;line-height:28px;">
                Sophie, Max mérite le meilleur
              </p>
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#374151;">
                Bonjour Sophie,
              </p>
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#374151;">
                Il y a quelques jours, vous avez échangé avec <strong>Camille</strong> à Lausanne — et d'après vos messages, le courant semblait bien passer. Vous n'avez pas encore finalisé la réservation, et on voulait s'assurer que tout allait bien.
              </p>
              <p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#374151;">
                Confier Max à quelqu'un de confiance, c'est un moment important. Chez DogShift, chaque sitter est vérifié manuellement — nous nous assurons que votre chien soit entre de bonnes mains, avec une personne qui le traitera comme le sien.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151;">
                Si vous avez des questions ou si vous souhaitez discuter avec Camille avant de confirmer, n'hésitez pas — on est là pour vous aider.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td align="center">
                    <center>
                      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="border-collapse:separate;">
                        <tr>
                          <td align="center" bgcolor="#111827" style="border-radius:10px;">
                            <a href="${BASE_URL}/sitters" style="display:block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:10px;">
                              Finaliser ma réservation →
                            </a>
                          </td>
                        </tr>
                      </table>
                    </center>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;line-height:20px;color:#6b7280;text-align:center;">
                Avec plaisir,<br />
                <strong>L'équipe DogShift</strong> · <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 4px 0;font-size:11px;line-height:18px;color:#9ca3af;text-align:center;">
              Cet email est <strong>généré par IA (Claude)</strong> — le contenu varie à chaque envoi selon le contexte du propriétaire et du sitter.
              <br />DogShift • <a href="mailto:support@dogshift.ch" style="color:#9ca3af;">support@dogshift.ch</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      };

    // ── Vérification d'identité ──────────────────────────────────────────────
    case "verification-identity-approved": {
      const { html } = renderEmailLayout({
        title: "Votre identité a été vérifiée — Bienvenue sur DogShift ✓",
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
          <p style="margin:0 0 12px 0;">Bonne nouvelle, Camille !</p>
          <p style="margin:0 0 12px 0;">
            Votre identité a été <strong style="color:#059669;">vérifiée avec succès</strong>.
            Votre profil est maintenant éligible à la publication sur DogShift.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            Pensez à compléter votre profil et à activer la publication depuis votre tableau de bord.
          </p>
        </div>`,
        ctaLabel: "Voir mon profil",
        ctaUrl: `${BASE_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      return { subject: "Votre identité a été vérifiée — Bienvenue sur DogShift ✓", html };
    }

    case "verification-identity-rejected": {
      const { html } = renderEmailLayout({
        title: "Vérification d'identité — Action requise",
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
          <p style="margin:0 0 12px 0;">Bonjour Camille,</p>
          <p style="margin:0 0 16px 0;">
            Malheureusement, nous n'avons pas pu valider votre demande de vérification d'identité.<br/>
            <strong>Motif :</strong> Les documents soumis ne sont pas lisibles. Merci de resoumettre en photo nette.
          </p>
          <p style="margin:0 0 12px 0;">
            Vous pouvez soumettre de nouveaux documents depuis votre profil.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            En cas de question : <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>
          </p>
        </div>`,
        ctaLabel: "Resoumettre mes documents",
        ctaUrl: `${BASE_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      return { subject: "Vérification d'identité — Action requise", html };
    }

    // ── Vérification Pension ─────────────────────────────────────────────────
    case "pension-submission-receipt": {
      const { html } = renderEmailLayout({
        title: "Vos photos ont bien été reçues — Vérification Pension",
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
          <p style="margin:0 0 12px 0;">Bonjour Camille,</p>
          <p style="margin:0 0 12px 0;">
            Nous avons bien reçu vos <strong>4 photos</strong> pour la vérification de votre logement.
          </p>
          <p style="margin:0 0 12px 0;">
            Notre équipe va les examiner et vous envoyer une réponse dans les <strong>24–48 heures ouvrées</strong>.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            En cas de question : <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>
          </p>
        </div>`,
        ctaLabel: "Voir mon profil",
        ctaUrl: `${BASE_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      return { subject: "Vos photos ont bien été reçues — Vérification Pension", html };
    }

    case "pension-approved": {
      const { html } = renderEmailLayout({
        title: "Votre logement est vérifié — Pension activée",
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
          <p style="margin:0 0 12px 0;">Bonne nouvelle, Camille !</p>
          <p style="margin:0 0 12px 0;">
            Votre logement a été analysé et répond à nos critères de qualité
            <strong style="color:#059669;">(score 82/100)</strong>.
            Le service <strong>Pension</strong> est maintenant actif sur votre profil public.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            Les propriétaires peuvent désormais vous réserver pour une pension. Pensez à bien configurer vos disponibilités.
          </p>
        </div>`,
        ctaLabel: "Voir mon profil",
        ctaUrl: `${BASE_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      return { subject: "Votre logement est vérifié — Pension activée", html };
    }

    case "pension-needs-review": {
      const { html } = renderEmailLayout({
        title: "Vos photos sont en cours d'examen — Pension",
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
          <p style="margin:0 0 12px 0;">Bonjour Camille,</p>
          <p style="margin:0 0 12px 0;">
            Vos photos ont été analysées automatiquement <strong>(score 48/100)</strong>.
            Elles nécessitent une vérification manuelle complémentaire par notre équipe.
          </p>
          <p style="margin:0 0 12px 0;">Vous recevrez une réponse définitive dans les 48 heures ouvrées.</p>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            Si vous avez des questions : <a href="mailto:support@dogshift.ch" style="color:#6b7280;">support@dogshift.ch</a>
          </p>
        </div>`,
        ctaLabel: "Voir mon profil",
        ctaUrl: `${BASE_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      return { subject: "Vos photos sont en cours d'examen — Pension", html };
    }

    case "pension-rejected": {
      const { html } = renderEmailLayout({
        title: "Photos de vérification refusées — Pension",
        extraHtml: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
          <p style="margin:0 0 12px 0;">Bonjour Camille,</p>
          <p style="margin:0 0 16px 0;">
            Malheureusement, vos photos n'ont pas atteint le niveau requis
            <strong style="color:#dc2626;">(score 22/100, minimum requis : 50/100)</strong>.
          </p>
          <p style="margin:0 0 12px 0;"><strong>Conseils pour améliorer vos photos :</strong></p>
          <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;line-height:22px;">
            <li style="margin-bottom:6px;">Photographiez les pièces principales (salon, chambre, cuisine)</li>
            <li style="margin-bottom:6px;">Assurez-vous que le logement est bien éclairé et rangé</li>
            <li style="margin-bottom:6px;">Montrez l'espace où le chien pourra dormir</li>
            <li style="margin-bottom:6px;">Incluez une vue extérieure si vous avez un jardin ou une terrasse</li>
          </ul>
          <p style="margin:0;color:#6b7280;font-size:13px;">
            Vous pouvez soumettre de nouvelles photos à tout moment depuis votre profil.
          </p>
        </div>`,
        ctaLabel: "Resoumettre mes photos",
        ctaUrl: `${BASE_URL}/host/profile/edit`,
        footerText: "DogShift · Dog-sitting premium en Suisse · support@dogshift.ch",
      });
      return { subject: "Photos de vérification refusées — Pension", html };
    }

    // ── Inactivité sitter ────────────────────────────────────────────────────
    case "inactivity-nudge": {
      const { html } = renderEmailLayout({
        title: "Ajoutez vos disponibilités pour être visible",
        subtitle: "Bonjour Camille,",
        ctaLabel: "Gérer mes disponibilités",
        ctaUrl: `${BASE_URL}/host/availability`,
        footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
        extraHtml: `
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            Votre profil est publié mais vous n'avez pas encore renseigné vos disponibilités.
            Sans disponibilités, les propriétaires ne peuvent pas vous réserver.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            Prenez deux minutes pour indiquer vos créneaux disponibles — c'est rapide et ça fait toute la différence !
          </p>
        `,
      });
      return { subject: "Ajoutez vos disponibilités pour recevoir des réservations — DogShift", html };
    }

    case "inactivity-warning1": {
      const { html } = renderEmailLayout({
        title: "Avertissement — votre compte sera suspendu",
        subtitle: "Bonjour Camille,",
        ctaLabel: "Ajouter mes disponibilités maintenant",
        ctaUrl: `${BASE_URL}/host/availability`,
        footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
        extraHtml: `
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            Cela fait plusieurs jours que votre profil est publié sans aucune disponibilité renseignée.
            Les propriétaires ne peuvent pas vous contacter ni vous réserver.
          </p>
          <p style="color:#b45309;font-size:15px;font-weight:600;line-height:1.6;margin:16px 0">
            Si vous n'ajoutez pas de disponibilités dans les 3 prochains jours,
            votre compte sera suspendu pour inactivité.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            Si vous souhaitez mettre votre profil en pause temporairement, vous pouvez le désactiver
            depuis vos paramètres — cela évite toute suspension automatique.
          </p>
        `,
      });
      return { subject: "Votre compte sera suspendu — ajoutez vos disponibilités — DogShift", html };
    }

    case "inactivity-warning2": {
      const { html } = renderEmailLayout({
        title: "Dernier avertissement — suspension imminente",
        subtitle: "Bonjour Camille,",
        ctaLabel: "Ajouter mes disponibilités maintenant",
        ctaUrl: `${BASE_URL}/host/availability`,
        footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
        extraHtml: `
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            C'est votre dernier avertissement. Votre profil est publié depuis plusieurs jours
            sans aucune disponibilité, et les propriétaires ne peuvent pas vous réserver.
          </p>
          <p style="color:#dc2626;font-size:15px;font-weight:600;line-height:1.6;margin:16px 0">
            Sans action de votre part dans les 2 prochains jours,
            votre compte sera suspendu automatiquement pour inactivité.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            En cas de suspension, vous devrez contacter notre support pour débloquer votre compte.
          </p>
        `,
      });
      return { subject: "Dernier avertissement — suspension imminente — DogShift", html };
    }

    // ── Sitter templates ──────────────────────────────────────────────────

    case "sitter-booking-confirmed": {
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "Réservation confirmée",
        subtitle: "Le propriétaire a confirmé la réservation.",
        summaryRows: [
          { label: "Service", value: "Promenade (1h)" },
          { label: "Début", value: "lun. 06 mai 2026, 10:00" },
          { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
          { label: "Total", value: "44.50 CHF" },
          { label: "Référence", value: "bk_preview_demo_2026" },
          { label: "Propriétaire", value: "Sophie Martin" },
          { label: "Chien", value: "Max (Golden Retriever)" },
        ],
        extraHtml: buildMockTravelMapHtml(),
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/host/requests`,
        secondaryLinkLabel: "Contacter le propriétaire",
        secondaryLinkUrl: `${BASE_URL}/host/messages`,
      });
      return { subject: "Réservation confirmée – DogShift", html };
    }

    case "sitter-booking-reminder": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const ownerContactHtml = `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
          <tr><td style="padding:14px 18px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Propriétaire</div>
            <div style="font-family:${FF};font-size:15px;font-weight:700;color:#0f172a;">Sophie Martin</div>
            <div style="font-family:${FF};font-size:13px;color:#475569;margin-top:4px;">📞 +41 79 123 45 67</div>
          </td></tr>
        </table>`;
      const checklistItems = ["Vérifier le créneau et l'adresse", "Charger le téléphone", "Prévoir laisse de secours, sac à déjections, eau", "Bien lire les notes du propriétaire"];
      const checkIcon = `<span style="color:#10b981;font-weight:bold;font-size:14px;display:inline-block;width:20px;">✓</span>`;
      const checklistHtml = `
        <div style="margin-top:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
          <h3 style="margin:0 0 14px;font-family:${FF};font-size:14px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Ta checklist</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
            ${checklistItems.map(item => `<tr><td valign="top" style="padding:4px 0;width:24px;">${checkIcon}</td><td valign="top" style="padding:4px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;">${item}</td></tr>`).join("")}
          </table>
        </div>`;
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "Rappel de prestation",
        subtitle: "Demain, tu as une prestation prévue. Voici un petit récap.",
        summaryRows: [
          { label: "Service", value: "Promenade (1h)" },
          { label: "Début", value: "lun. 06 mai 2026, 10:00" },
          { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
          { label: "Lieu de prise en charge", value: "Rue de Bourg 12, 1003 Lausanne" },
        ],
        extraHtml: ownerContactHtml + buildMockTravelMapHtml() + checklistHtml,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/host/requests`,
      });
      return { subject: "Rappel de prestation – DogShift", html };
    }

    case "sitter-payout-received": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "Virement reçu",
        subtitle: "Le paiement a été transféré sur ton compte.",
        extraHtml: `
          <div style="margin-top:20px;text-align:center;padding:24px 0;">
            <div style="font-family:${FF};font-size:36px;font-weight:800;color:#15803d;">44.50 CHF</div>
            <div style="font-family:${FF};font-size:13px;color:#6b7280;margin-top:8px;">Le virement apparaît sous 1–3 jours ouvrés</div>
          </div>
          <div style="margin-top:16px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Réservation concernée</div>
            <div style="font-family:${FF};font-size:13px;color:#475569;padding:4px 0;">Réservation #bk_preview_demo_2026</div>
          </div>
          <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Bon à savoir</div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">🏦</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Délai bancaire</strong> — le virement peut mettre 1 à 3 jours ouvrés à apparaître sur ton relevé.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📊</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Historique</strong> — retrouve tous tes virements passés dans ton portefeuille DogShift.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📝</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Comptabilité</strong> — pense à conserver tes relevés pour ta déclaration fiscale.</td></tr>
            </table>
          </div>`,
        ctaLabel: "Voir mon portefeuille",
        ctaUrl: `${BASE_URL}/host/wallet`,
      });
      return { subject: "Virement reçu – DogShift", html };
    }

    case "sitter-booking-modified": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "Réservation modifiée",
        subtitle: "Le propriétaire a modifié les détails de la réservation. Vérifie que tout te convient.",
        summaryRows: MOCK_BOOKING_ROWS,
        extraHtml: `
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:18px;background:#fefce8;border:1px solid #fde68a;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400e;margin-bottom:10px;">Modifications</div>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 0;font-family:${FF};font-size:13px;font-weight:600;color:#64748b;">Début</td>
                  <td style="padding:6px 0 6px 12px;font-family:${FF};font-size:13px;">
                    <span style="text-decoration:line-through;color:#94a3b8;">lun. 06 mai 2026, 10:00</span><br/>
                    <span style="color:#15803d;font-weight:600;">mar. 07 mai 2026, 14:00</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Que faire maintenant ?</div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">🔍</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Vérifie les nouveaux horaires</strong> — assure-toi que le créneau modifié est compatible avec ton emploi du temps.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">💬</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Contacte le propriétaire</strong> — si un détail te pose problème, n'hésite pas à en discuter.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📅</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Mets à jour ton agenda</strong> — pense à adapter tes disponibilités si nécessaire.</td></tr>
            </table>
          </div>`,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/host/requests`,
        secondaryLinkLabel: "Contacter le propriétaire",
        secondaryLinkUrl: `${BASE_URL}/host/messages`,
      });
      return { subject: "Réservation modifiée – DogShift", html };
    }

    case "sitter-refund-triggered-eligible": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "La réservation du lun. 06 mai 2026 a été annulée",
        subtitle: "Voici ce que cela signifie pour toi.",
        summaryRows: [
          { label: "Service", value: "Promenade (1h)" },
          { label: "Début", value: "lun. 06 mai 2026, 10:00" },
          { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
          { label: "Référence", value: "bk_preview_demo_2026" },
        ],
        extraHtml: `
          <div style="margin-top:20px;padding:18px 20px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;">
            <div style="font-family:${FF};font-size:14px;line-height:22px;color:#991b1b;">
              La réservation a été annulée plus de 24h avant le début. Aucune rémunération n'est due pour cette prestation.
            </div>
          </div>
          <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Ce que tu peux faire</div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📅</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Créneau libéré</strong> — ton créneau est à nouveau disponible pour d'autres réservations.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">🔄</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Reste visible</strong> — vérifie que tes disponibilités sont à jour pour maximiser tes demandes.</td></tr>
            </table>
          </div>`,
        ctaLabel: "Voir mes réservations",
        ctaUrl: `${BASE_URL}/host/requests`,
        secondaryLinkLabel: "Mettre à jour mes disponibilités",
        secondaryLinkUrl: `${BASE_URL}/host/availability`,
      });
      return { subject: "Annulation de réservation – DogShift", html };
    }

    case "sitter-refund-triggered-late": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "La réservation du lun. 06 mai 2026 a été annulée",
        subtitle: "Voici ce que cela signifie pour toi.",
        summaryRows: [
          { label: "Service", value: "Promenade (1h)" },
          { label: "Début", value: "lun. 06 mai 2026, 10:00" },
          { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
          { label: "Référence", value: "bk_preview_demo_2026" },
        ],
        extraHtml: `
          <div style="margin-top:20px;padding:18px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
            <div style="font-family:${FF};font-size:14px;line-height:22px;color:#166534;">
              L'annulation étant tardive (moins de 24h avant le début), ta rémunération de <strong>44.50 CHF</strong> reste acquise.
            </div>
          </div>
          <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Bon à savoir</div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">✅</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Rémunération maintenue</strong> — le montant sera inclus dans ton prochain virement.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📅</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Créneau libéré</strong> — ton créneau est à nouveau disponible pour d'autres demandes.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">🙏</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Merci pour ta réactivité</strong> — les propriétaires apprécient les sitters fiables et disponibles.</td></tr>
            </table>
          </div>`,
        ctaLabel: "Voir mes réservations",
        ctaUrl: `${BASE_URL}/host/requests`,
        secondaryLinkLabel: "Voir mon portefeuille",
        secondaryLinkUrl: `${BASE_URL}/host/wallet`,
      });
      return { subject: "Annulation de réservation – DogShift", html };
    }

    case "sitter-review-received": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const stars = Array.from({ length: 5 }, (_, i) =>
        i < 4
          ? `<span style="color:#eab308;font-size:22px;">★</span>`
          : `<span style="color:#d1d5db;font-size:22px;">★</span>`
      ).join("");
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "Sophie vient de te laisser un avis ⭐",
        subtitle: "Découvre ce qu'elle a pensé de la prestation.",
        extraHtml: `
          <div style="margin-top:20px;text-align:center;">
            <div style="margin-bottom:8px;">${stars}</div>
            <div style="font-family:${FF};font-size:14px;color:#6b7280;">4/5</div>
          </div>
          <div style="margin-top:12px;padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
            <div style="font-family:${FF};font-size:14px;line-height:22px;color:#374151;font-style:italic;">"Camille est très douce avec Max, elle l'a promené avec beaucoup de soin. Je recommande !"</div>
            <div style="margin-top:8px;font-family:${FF};font-size:12px;color:#94a3b8;">— Sophie Martin</div>
          </div>
          <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Pourquoi les avis comptent</div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">🏆</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Visibilité</strong> — les sitters bien notés apparaissent en priorité dans les résultats de recherche.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">🤝</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Confiance</strong> — les avis positifs rassurent les nouveaux propriétaires et boostent tes réservations.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📈</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Progression</strong> — chaque retour est une occasion de t'améliorer et d'affiner tes services.</td></tr>
            </table>
          </div>`,
        ctaLabel: "Voir mes avis",
        ctaUrl: `${BASE_URL}/host/profile`,
      });
      return { subject: "Sophie t'a laissé un avis ⭐ – DogShift", html };
    }

    case "sitter-monthly-recap": {
      const FF = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif";
      const statCell = (label: string, value: string, accent = "#0f172a") => `
        <td align="center" style="padding:12px 8px;">
          <div style="font-family:${FF};font-size:24px;font-weight:800;color:${accent};line-height:1.2;">${value}</div>
          <div style="font-family:${FF};font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px;">${label}</div>
        </td>`;
      const { html } = renderEmailLayout({
        logoUrl: LOGO_URL,
        audience: "sitter",
        title: "Récap du mois d'avril",
        subtitle: "Voici ton récap du mois écoulé. Bravo pour ton engagement !",
        extraHtml: `
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <tr>
              ${statCell("Prestations", "8")}
              ${statCell("Heures", "12")}
            </tr>
            <tr>
              ${statCell("Revenus", "356.00 CHF", "#15803d")}
              ${statCell("Note moyenne", "★ 4.8", "#eab308")}
            </tr>
          </table>
          <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;">
            <div style="font-family:${FF};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:12px;">Conseils pour le mois prochain</div>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📅</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Anticipe tes disponibilités</strong> — ajoute tes créneaux à l'avance pour être visible des propriétaires qui planifient tôt.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">📸</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Soigne ton profil</strong> — une photo récente et une description détaillée font la différence.</td></tr>
              <tr><td valign="top" style="padding:5px 0;width:24px;font-size:16px;">⭐</td><td style="padding:5px 0;font-family:${FF};font-size:14px;line-height:20px;color:#475569;"><strong>Encourage les avis</strong> — après chaque prestation, un petit mot au propriétaire peut faire toute la différence.</td></tr>
            </table>
          </div>`,
        ctaLabel: "Voir mon tableau de bord",
        ctaUrl: `${BASE_URL}/host`,
      });
      return { subject: "Récap avril – DogShift", html };
    }

    case "inactivity-suspended": {
      const { html } = renderEmailLayout({
        title: "Votre compte a été suspendu",
        subtitle: "Bonjour Camille,",
        ctaLabel: "Contacter le support",
        ctaUrl: "mailto:support@dogshift.ch",
        footerText: "Vous recevez cet e-mail car vous êtes dogsitter sur DogShift.",
        extraHtml: `
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            Votre compte dogsitter a été <strong>suspendu pour inactivité</strong> : votre profil
            était publié depuis plusieurs jours sans aucune disponibilité renseignée.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            Votre profil n'est plus visible dans les résultats de recherche.
          </p>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:16px 0">
            Pour réactiver votre compte, contactez-nous à
            <a href="mailto:support@dogshift.ch" style="color:#2563eb">support@dogshift.ch</a>
            en précisant votre adresse e-mail et la raison de votre inactivité.
          </p>
        `,
      });
      return { subject: "Votre compte DogShift a été suspendu", html };
    }

    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const admin = await getRequestAdminAccess(req);
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const template = searchParams.get("template") ?? "";

  const result = await renderTemplate(template);
  if (!result) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_TEMPLATE" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, html: result.html, subject: result.subject });
}

const TEST_EMAIL_RECIPIENT = "contact@dogshift.ch";

export async function POST(req: NextRequest) {
  const admin = await getRequestAdminAccess(req);
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { template?: string };
  const template = typeof body.template === "string" ? body.template : "";

  const result = await renderTemplate(template);
  if (!result) {
    return NextResponse.json({ ok: false, error: "UNKNOWN_TEMPLATE" }, { status: 400 });
  }

  await sendEmail({
    to: TEST_EMAIL_RECIPIENT,
    subject: `[TEST] ${result.subject}`,
    text: `Ceci est un email de test pour le template "${template}". Consultez la version HTML.`,
    html: result.html,
  });

  return NextResponse.json({ ok: true });
}
