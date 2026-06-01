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

export const runtime = "nodejs";

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
const LOGO_URL = `${BASE_URL}/dogshift-logo.png`;

const MOCK_BOOKING_ROWS = [
  { label: "Service", value: "Promenade (1h)" },
  { label: "Début", value: "lun. 06 mai 2026, 10:00" },
  { label: "Fin", value: "lun. 06 mai 2026, 11:00" },
  { label: "Montant", value: "35.00 CHF" },
  { label: "Référence", value: "bk_preview_demo_2026" },
];

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
        summaryRows: MOCK_BOOKING_ROWS,
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
        summaryRows: MOCK_BOOKING_ROWS,
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

    default:
      return NextResponse.json({ ok: false, error: "UNKNOWN_TEMPLATE" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, html, subject });
}
