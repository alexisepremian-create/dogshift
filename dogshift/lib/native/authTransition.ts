"use client";

/**
 * Coordinates the single branded (purple + paw) cover that masks the native
 * logout AND login transitions, so the user only ever sees the brand splash —
 * never the cascade of skeleton / cold-splash / skeleton that both flows used
 * to flash (both do hard `window.location.replace` navigations that cross
 * several loading boundaries).
 *
 * Mechanism (mirrors lib/auth/signoutHandoff.ts): a millisecond timestamp in
 * sessionStorage + a `data-auth-transition` attribute on <html>. sessionStorage
 * survives the hard navigation (unlike React state) and is tab/WebView-scoped,
 * so <AuthTransitionCover> can read it synchronously on the very first render
 * after each reload and paint the purple cover before any skeleton appears.
 *
 * Only the native app sets this — web auth is unchanged.
 */

export const AUTH_TRANSITION_KEY = "ds_auth_transition";
export const AUTH_TRANSITION_BEGIN_EVENT = "ds-auth-transition-begin";
export const AUTH_TRANSITION_END_EVENT = "ds-auth-transition-end";

/** Max age (ms) of the flag before it's treated as stale (failsafe upper bound). */
const MAX_AGE_MS = 12_000;

/** Start the transition: show the branded cover until end/failsafe. */
export function beginAuthTransition(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(AUTH_TRANSITION_KEY, String(Date.now()));
  } catch {
    /* private mode — ignore */
  }
  try {
    document.documentElement.setAttribute("data-auth-transition", "true");
  } catch {
    /* ignore */
  }
  // Same-document (client nav) case: tell the already-mounted cover to show now.
  // The hard-nav case is covered by AuthTransitionCover reading the flag on mount.
  try {
    window.dispatchEvent(new Event(AUTH_TRANSITION_BEGIN_EVENT));
  } catch {
    /* ignore */
  }
}

/** Whether a fresh transition flag is present (survives hard navigations). */
export function authTransitionActive(): boolean {
  if (typeof window === "undefined") return false;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(AUTH_TRANSITION_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  const ts = Number.parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < MAX_AGE_MS;
}

/** End the transition: clear the flag and signal the cover to fade out. */
export function endAuthTransition(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTH_TRANSITION_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.documentElement.removeAttribute("data-auth-transition");
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(AUTH_TRANSITION_END_EVENT));
  } catch {
    /* ignore */
  }
}
