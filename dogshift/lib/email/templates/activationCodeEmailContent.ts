/**
 * Pure (non-JSX) helpers for {@link ActivationCodeEmail}.
 *
 * Kept in a `.ts` file so the Node test runner (which uses
 * --experimental-strip-types and cannot load `.tsx`) can import them directly.
 *
 * Mirrors the split used for applicationStatusEmail: subject / preview / plain
 * text live here, the React Email component lives in activationCodeEmail.tsx.
 */

const DEFAULT_APP_URL = "https://www.dogshift.ch";

export type ActivationCodeEmailParams = {
  firstName: string;
  activationCode: string;
  /**
   * Optional expiration date (ISO string or Date). Rendered as a French
   * "jusqu'au 1 mai 2026" line if present. Safe to omit when unavailable.
   */
  expiresAt?: Date | string | null;
  /** Base URL used to generate the "Go to dashboard" CTA. Falls back to dogshift.ch. */
  baseUrl?: string;
};

export function activationCodeEmailSubject(): string {
  return "🎉 Ton contrat est signé — voici ton code d’activation DogShift";
}

export function activationCodeEmailDefaultPreviewText(): string {
  return "Ton code d’activation DogShift est prêt — active ton compte dogsitter en 1 minute.";
}

/**
 * Formats an optional expiry instant as a French date (e.g. "1 mai 2026").
 * Returns null when the input is missing or invalid.
 */
export function formatActivationCodeExpiry(
  expiresAt: Date | string | null | undefined,
): string | null {
  if (!expiresAt) return null;
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function activationCodeEmailPlainText(params: ActivationCodeEmailParams): string {
  const firstName = (params.firstName || "").trim();
  const greeting = `Bonjour${firstName ? ` ${firstName}` : ""},`;
  const baseUrl = (params.baseUrl || DEFAULT_APP_URL).trim().replace(/\/$/, "") || DEFAULT_APP_URL;
  const dashboardUrl = `${baseUrl}/host`;
  const expiryLabel = formatActivationCodeExpiry(params.expiresAt);

  const expiryLine = expiryLabel
    ? `Ce code est valable jusqu'au ${expiryLabel}. Passée cette date, demande-nous un nouveau code.\n\n`
    : "";

  return (
    `${greeting}\n\n` +
    `Bienvenue chez DogShift ! Ton contrat est signé et ton compte dogsitter est prêt à être activé.\n\n` +
    `Ton code d'activation :\n\n` +
    `    ${params.activationCode}\n\n` +
    `Connecte-toi sur ton dashboard et saisis ce code pour activer ton profil :\n` +
    `${dashboardUrl}\n\n` +
    expiryLine +
    `À très vite sur DogShift,\n\n` +
    `— L'équipe DogShift\n\n` +
    `Besoin d'aide ? support@dogshift.ch\n`
  );
}
