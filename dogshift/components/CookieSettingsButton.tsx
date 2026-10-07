"use client";

import { clearFunnelStorage } from "@/lib/analytics/funnel";
import { CONSENT_COOKIE_NAME } from "@/lib/cookieConsent";

/**
 * Resets the cookie consent by deleting the cookie and reloading the page,
 * causing the consent banner to reappear. Placed in the footer (RGPD requirement).
 */
export default function CookieSettingsButton() {
  function handleClick() {
    clearFunnelStorage();
    document.cookie = `${CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    for (const item of document.cookie.split(";")) {
      const name = item.trim().split("=")[0];
      if (name === "_ga" || name.startsWith("_ga_") || name.startsWith("_gcl_")) {
        for (const domain of ["", `; Domain=${location.hostname}`, "; Domain=.dogshift.ch"]) {
          document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
        }
      }
    }
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
