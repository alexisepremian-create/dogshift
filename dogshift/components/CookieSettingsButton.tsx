"use client";

import { CONSENT_COOKIE_NAME } from "@/lib/cookieConsent";

/**
 * Resets the cookie consent by deleting the cookie and reloading the page,
 * causing the consent banner to reappear. Placed in the footer (RGPD requirement).
 */
export default function CookieSettingsButton() {
  function handleClick() {
    document.cookie = `${CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-900"
    >
      Gérer les cookies
    </button>
  );
}
