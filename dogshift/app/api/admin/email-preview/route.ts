import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { render } from "@react-email/render";

import { getRequestAdminAccess } from "@/lib/adminAuth";
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
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="border-radius:12px;overflow:hidden;border:1px solid #e0e7ff;">
          <img
            src="${mapUrl}"
            alt="Carte du trajet"
            width="516"
            style="display:block;width:100%;max-width:516px;height:auto;border-radius:12px 12px 0 0;"
          />
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f5f3ff;border-top:1px solid #e0e7ff;">
            <tr>
              <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;">
                <span style="color:#4f46e5;font-weight:700;">&#x1F4CD; 4.8 km</span>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                <span style="color:#059669;font-weight:700;">Frais : CHF 9.50</span>
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

export async function GET(req: NextRequest) {
  const admin = await getRequestAdminAccess(req);
  if (!admin.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const template = searchParams.get("template") ?? "";

  let html = "";
  let subject = "";

  switch (template) {
    case "activation-code": {
      subject = "Ton code d'activation DogShift";
      html = await render(
        ActivationCodeEmail({
          baseUrl: BASE_URL,
          firstName: "Sophie",
          activationCode: "DEMO-2026",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
      );
      break;
    }

    case "application-high": {
      subject = "Ta candidature DogShift — bonne nouvelle 🎉";
      html = await render(
        ApplicationStatusEmail({
          baseUrl: BASE_URL,
          firstName: "Sophie",
          lastName: "Martin",
          status: "HIGH",
          calendlyLink: "https://calendly.com/dogshift/entretien",
        }),
      );
      break;
    }

    case "application-review": {
      subject = "Ta candidature DogShift est à l'étude";
      html = await render(
        ApplicationStatusEmail({
          baseUrl: BASE_URL,
          firstName: "Sophie",
          lastName: "Martin",
          status: "REVIEW",
        }),
      );
      break;
    }

    case "application-low": {
      subject = "Ta candidature DogShift";
      html = await render(
        ApplicationStatusEmail({
          baseUrl: BASE_URL,
          firstName: "Sophie",
          lastName: "Martin",
          status: "LOW",
        }),
      );
      break;
    }

    case "communications": {
      subject = "Mise à jour de nos Conditions Générales d'Utilisation";
      html = await render(
        CommunicationsEmail({
          baseUrl: BASE_URL,
          firstName: "Sophie",
          subject: "Mise à jour de nos Conditions Générales d'Utilisation",
          customMessage:
            "Nous avons clarifié les conditions relatives aux annulations et au traitement de vos données personnelles.\n\nCes nouvelles conditions entrent en vigueur le 1er juin 2026.",
        }),
      );
      break;
    }

    case "pilot-confirmation": {
      subject = "Candidature reçue — DogShift";
      html = await render(
        PilotSitterApplicationConfirmationEmail({
          baseUrl: BASE_URL,
          firstName: "Sophie",
        }),
      );
      break;
    }

    case "lead-magnet": {
      subject = "Votre guide gratuit est prêt 🐕";
      html = renderLeadMagnetEmail({ baseUrl: BASE_URL }).html;
      break;
    }

    case "zootherapie": {
      subject = "Votre évaluation bien-être personnalisée";
      html = renderZootherapieEmail({
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
      }).html;
      break;
    }

    case "new-message": {
      subject = "Nouveau message sur DogShift";
      html = renderEmailLayout({
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
      }).html;
      break;
    }

    case "booking-request": {
      subject = "Nouvelle demande de réservation – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Nouvelle demande de réservation",
        subtitle: "Tu as reçu une nouvelle demande.",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/host/requests`,
      }).html;
      break;
    }

    case "booking-confirmed": {
      subject = "Réservation confirmée – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Réservation confirmée",
        subtitle: "Ta réservation a été confirmée.",
        summaryRows: MOCK_TRAVEL_BOOKING_ROWS,
        extraHtml: buildMockTravelMapHtml(),
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/account/bookings`,
      }).html;
      break;
    }

    case "payment-received": {
      subject = "Paiement reçu – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Paiement reçu",
        subtitle: "Le paiement a bien été reçu.",
        summaryRows: MOCK_TRAVEL_BOOKING_ROWS,
        extraHtml: buildMockTravelMapHtml(),
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/account/bookings`,
      }).html;
      break;
    }

    case "booking-reminder": {
      subject = "Rappel de réservation – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Rappel de réservation",
        subtitle: "Une réservation approche.",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/account/bookings`,
      }).html;
      break;
    }

    case "booking-cancelled": {
      subject = "Réservation annulée – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Réservation annulée",
        subtitle: "Une réservation a été annulée.",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/account/bookings`,
      }).html;
      break;
    }

    case "booking-refunded-owner": {
      subject = "Remboursement effectué – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Remboursement effectué",
        subtitle: "Le remboursement a été effectué.",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/account/bookings`,
      }).html;
      break;
    }

    case "booking-refunded-host": {
      subject = "Réservation annulée – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Réservation annulée",
        subtitle:
          "Une réservation a été annulée. Le remboursement du propriétaire a été traité conformément aux conditions applicables.",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/host/requests`,
      }).html;
      break;
    }

    case "booking-expired": {
      subject = "Réservation expirée et remboursée – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Réservation expirée et remboursée",
        subtitle:
          "Le dogsitter n'a pas accepté à temps. La réservation a été annulée automatiquement et le remboursement a été déclenché avant J-24h.",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/account/bookings`,
      }).html;
      break;
    }

    case "booking-refund-failed": {
      subject = "Remboursement impossible – DogShift";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Remboursement impossible",
        subtitle: "Le remboursement a échoué. Notre équipe peut t'aider.",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Voir la réservation",
        ctaUrl: `${BASE_URL}/account/bookings`,
      }).html;
      break;
    }

    case "welcome-owner": {
      subject = "Bienvenue sur DogShift";
      html = renderEmailLayout({
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
      }).html;
      break;
    }

    case "review-request": {
      subject = "Comment s'est passée votre réservation avec Marie ?";
      html = renderEmailLayout({
        logoUrl: LOGO_URL,
        title: "Noter votre sitter",
        subtitle: "Votre réservation avec Marie est maintenant terminée. Comment s'est-elle passée ?",
        summaryTitle: "Résumé",
        summaryRows: MOCK_BOOKING_ROWS,
        ctaLabel: "Laisser un avis",
        ctaUrl: `${BASE_URL}/account/bookings/bk_preview_demo_2026/review`,
        footerText: "Votre avis aide la communauté DogShift.",
      }).html;
      break;
    }

    case "nurturing-step1": {
      subject = "Avez-vous eu le temps de lire votre guide ? 🐾";
      html = renderNurturingStep1({ baseUrl: BASE_URL, prenom: "Sophie" }).html;
      break;
    }

    case "nurturing-step2": {
      subject = "Ce que disent les autres propriétaires de DogShift";
      html = renderNurturingStep2({ baseUrl: BASE_URL, prenom: "Sophie" }).html;
      break;
    }

    case "nurturing-step3": {
      subject = "Votre chien mérite le meilleur sitter 🐾";
      html = renderNurturingStep3({ baseUrl: BASE_URL, prenom: "Sophie" }).html;
      break;
    }

    case "relance-owner": {
      subject = "Sophie, votre chien mérite la meilleure attention 🐾";
      // Relance emails are fully AI-generated by Claude — this is a representative mock.
      html = `<!doctype html>
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
                Sophie, Max mérite le meilleur 🐾
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
              ⚠️ Cet email est <strong>généré par IA (Claude)</strong> — le contenu varie à chaque envoi selon le contexte du propriétaire et du sitter.
              <br />DogShift • <a href="mailto:support@dogshift.ch" style="color:#9ca3af;">support@dogshift.ch</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      break;
    }

    default:
      return NextResponse.json({ ok: false, error: "UNKNOWN_TEMPLATE" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, html, subject });
}
