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

/** Start the transition: show the branded splash until end/failsafe. */
export function beginAuthTransition(): void {
  if (typeof window === "undefined") return;
  // Native only — the branded splash is a native-app affordance. Web auth is
  // unchanged (the CSS splash is not data-native-gated, so we must not set the
  // flag on web; some callers, e.g. /sign-out, invoke this unconditionally).
  if (document.documentElement.getAttribute("data-native") !== "true") return;
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

/** Exit-animation duration (ms) — matches the #ds-auth-splash grow+fade. */
const EXIT_FADE_MS = 700;

/**
 * End the transition: fade the splash out, then drop the attributes + flag.
 * Idempotent — safe to call from several destinations (login screen, the sitter
 * + owner dashboard gates, the failsafe); only the first call starts the fade.
 */
export function endAuthTransition(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTH_TRANSITION_KEY);
  } catch {
    /* ignore */
  }
  const h = document.documentElement;
  // Nothing active, or already fading out → no-op.
  if (h.getAttribute("data-auth-transition") !== "true") return;
  if (h.getAttribute("data-auth-transition-exit") === "true") return;
  try {
    h.setAttribute("data-auth-transition-exit", "true");
    window.setTimeout(() => {
      h.removeAttribute("data-auth-transition");
      h.removeAttribute("data-auth-transition-exit");
      try {
        window.dispatchEvent(new Event(AUTH_TRANSITION_END_EVENT));
      } catch {
        /* ignore */
      }
    }, EXIT_FADE_MS);
  } catch {
    h.removeAttribute("data-auth-transition");
    h.removeAttribute("data-auth-transition-exit");
  }
}
