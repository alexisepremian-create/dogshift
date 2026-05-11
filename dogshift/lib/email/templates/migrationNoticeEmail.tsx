/**
 * Migration notice email — sent ONCE to existing users right after PR 2 ships,
 * announcing the auth-provider switch (Clerk → Auth.js) and asking them to
 * reset their password to regain access.
 *
 * Google-OAuth users are told they have nothing to do.
 */
import { renderEmailLayout } from "@/lib/email/templates/layout";

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.dogshift.ch").replace(/\/$/, "");
const LOGO_URL = `${BASE_URL}/dogshift-logo.png`;

export function renderMigrationNoticeEmail(params: {
  name: string | null;
  hasGoogleAccount: boolean;
}): { subject: string; html: string; text: string } {
  const firstName = params.name ? params.name.split(" ")[0] : null;
  const greeting = firstName ? `Salut ${firstName},` : "Salut,";
  const forgotUrl = `${BASE_URL}/forgot-password`;
  const loginUrl = `${BASE_URL}/login`;

  const bodyForGoogle = `
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;">
      Tu te connectes habituellement avec Google : <strong style="color:#0f172a;">tu n'as rien à faire</strong>. Continue à cliquer sur « Continuer avec Google » comme d'habitude.
    </p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#94a3b8;">
      Merci de ta confiance pendant cette phase pilote — on est là si tu as la moindre question.
    </p>
  `;

  const bodyForCredentials = `
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;">
      Pour des raisons de sécurité, ton ancien mot de passe ne fonctionne plus. Clique sur le bouton ci-dessous pour en définir un nouveau en 30 secondes — tu reçois un email, tu cliques, tu choisis, c'est bon.
    </p>
    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#94a3b8;">
      Désolé pour le dérangement, et merci de ta confiance pendant cette phase pilote.
    </p>
  `;

  const extraHtml = `
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0f172a;">
      ${greeting}
    </p>
    <p style="margin:0 0 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#475569;">
      On a fait évoluer le système de connexion de DogShift pour plus de fiabilité et de sécurité.
    </p>
    ${params.hasGoogleAccount ? bodyForGoogle : bodyForCredentials}
  `;

  const { html } = renderEmailLayout({
    logoUrl: LOGO_URL,
    baseUrl: BASE_URL,
    heroLabel: "ACTION REQUISE",
    title: "Important : action requise pour ton compte",
    subtitle: params.hasGoogleAccount
      ? "Bonne nouvelle : si tu te connectes avec Google, tu n'as rien à faire."
      : "Redéfinis ton mot de passe en 30 secondes pour continuer.",
    extraHtml,
    ctaLabel: params.hasGoogleAccount ? "Aller sur DogShift" : "Définir un nouveau mot de passe",
    ctaUrl: params.hasGoogleAccount ? loginUrl : forgotUrl,
    heroColor: params.hasGoogleAccount ? "purple" : "amber",
    audience: "owner",
    bannerImageUrl: "",
  });

  const subject = params.hasGoogleAccount
    ? "DogShift a évolué — bonne nouvelle, rien à faire pour toi"
    : "Important : redéfinis ton mot de passe DogShift en 30 secondes";

  const text = params.hasGoogleAccount
    ? `${greeting}\n\nOn a fait évoluer le système de connexion de DogShift. Tu te connectes avec Google : rien à faire, continue à cliquer sur "Continuer avec Google" comme d'habitude.\n\n${loginUrl}\n\n— Alexis, DogShift\nsupport@dogshift.ch\n`
    : `${greeting}\n\nOn a fait évoluer le système de connexion de DogShift pour plus de fiabilité. Pour continuer à te connecter, tu dois définir un nouveau mot de passe (les anciens ne sont plus valides pour des raisons de sécurité).\n\nClique ici pour le redéfinir (30 secondes) :\n${forgotUrl}\n\nDésolé pour le dérangement.\n\n— Alexis, DogShift\nsupport@dogshift.ch\n`;

  return { subject, html, text };
}
