export const CONSENT_COOKIE_NAME = "ds_cookie_consent";
export const CONSENT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export type ConsentLevel = "all" | "essential";

export function getConsentCookie(): ConsentLevel | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)`));
  const value = match?.[1];
  if (value === "all" || value === "essential") return value;
  return null;
}

export function setConsentCookie(level: ConsentLevel) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE_NAME}=${level}; Max-Age=${CONSENT_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}
