/**
 * Email verification — DogShift.
 *
 * Sent after sign-up (PR 2 wires it into the new credentials register flow).
 * Available now so PR 1 can be merged with the template ready.
 */
import { renderEmailLayout } from "@/lib/email/templates/layout";

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.dogshift.ch").replace(/\/$/, "");
const LOGO_URL = `${BASE_URL}/dogshift-logo.png`;

export function renderEmailVerificationEmail(params: {
  name: string | null;
  ctaUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] : null;
  const greeting = firstName ? `Bienvenue ${firstName} 👋` : "Bienvenue 👋";

  const extraHtml = `
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0f172a;">
      ${greeting}
    </p>
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;">
      Plus qu'une étape pour activer ton compte DogShift : confirme ton adresse email en cliquant sur le bouton ci-dessous.
    </p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#94a3b8;">
      Ce lien est valable 24 heures.
    </p>
  `;

  const { html } = renderEmailLayout({
    logoUrl: LOGO_URL,
    baseUrl: BASE_URL,
    heroLabel: "ACTIVATION DU COMPTE",
    title: "Vérifie ton adresse email",
    subtitle: "Active ton compte en un clic pour commencer à utiliser DogShift.",
    extraHtml,
    ctaLabel: "Vérifier mon email",
    ctaUrl: params.ctaUrl,
    audience: "owner",
    bannerImageUrl: "",
  });

  const text =
    `${greeting}\n\n` +
    `Plus qu'une étape pour activer ton compte DogShift.\n\n` +
    `Vérifie ton email en cliquant ici (valable 24 h) :\n${params.ctaUrl}\n\n` +
    `— L'équipe DogShift\nsupport@dogshift.ch\n`;

  return {
    subject: "Vérifie ton email DogShift",
    html,
    text,
  };
}
