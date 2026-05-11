/**
 * Password reset email — DogShift.
 *
 * Built on top of `renderEmailLayout()` (purple hero + white card + CTA + footer)
 * to match the rest of the transactional emails. Returns { subject, html, text }
 * for direct passing into `sendEmail()`.
 */
import { renderEmailLayout } from "@/lib/email/templates/layout";

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.dogshift.ch").replace(/\/$/, "");
const LOGO_URL = `${BASE_URL}/dogshift-logo.png`;

export function renderPasswordResetEmail(params: {
  name: string | null;
  ctaUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] : null;
  const greeting = firstName ? `Salut ${firstName},` : "Salut,";

  const extraHtml = `
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0f172a;">
      ${greeting}
    </p>
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;">
      Tu as demandé à réinitialiser ton mot de passe DogShift. Clique sur le bouton ci-dessous pour en définir un nouveau.
    </p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#94a3b8;">
      Ce lien expire dans <strong style="color:#475569;">1 heure</strong>. Si tu n'es pas à l'origine de cette demande, ignore simplement cet email — ton mot de passe actuel reste inchangé.
    </p>
  `;

  const { html } = renderEmailLayout({
    logoUrl: LOGO_URL,
    baseUrl: BASE_URL,
    heroLabel: "SÉCURITÉ DU COMPTE",
    title: "Réinitialise ton mot de passe",
    subtitle: "Un seul clic pour récupérer l'accès à ton compte DogShift.",
    extraHtml,
    ctaLabel: "Définir un nouveau mot de passe",
    ctaUrl: params.ctaUrl,
    audience: "owner",
    bannerImageUrl: "", // skip closing banner for transactional security email
  });

  const text =
    `${greeting}\n\n` +
    `Tu as demandé à réinitialiser ton mot de passe DogShift.\n\n` +
    `Clique ici pour en définir un nouveau (valable 1 heure) :\n${params.ctaUrl}\n\n` +
    `Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe actuel reste inchangé.\n\n` +
    `— L'équipe DogShift\nsupport@dogshift.ch\n`;

  return {
    subject: "Réinitialise ton mot de passe DogShift",
    html,
    text,
  };
}
