/**
 * Tiny coordination layer between /sign-out and /login so the auto-redirect
 * in /login doesn't bounce a user back to /post-login when arriving from
 * a fresh sign-out.
 *
 * Why this is needed:
 *   /sign-out calls Auth.js `signOut({ redirect: false })` then hard-navigates
 *   to /login. The browser receives a Set-Cookie header that clears the JWT
 *   session cookie. But on the new page mount, the next-auth/react
 *   SessionProvider does its own /api/auth/session fetch — there's a brief
 *   window where useSession() can still return the cached "authenticated"
 *   state from before the cookie was cleared. The auto-redirect in
 *   LoginPage would then fire and bounce the user back to /post-login.
 *
 * Mechanism: /sign-out writes a millisecond timestamp into sessionStorage
 * just before navigating. LoginPage reads it on mount and, if present and
 * fresh (<10 s), suppresses the auto-redirect for this visit only — and
 * then immediately consumes the flag so a subsequent in-tab navigation back
 * to /login does NOT inherit the suppression.
 *
 * sessionStorage chosen because:
 *   - Survives the hard navigation (unlike React state)
 *   - Scoped to the tab (no cross-tab leakage)
 *   - Synchronous read (no race with useEffect timing)
 */

export const SIGNOUT_HANDOFF_KEY = "ds_signout_handoff_ts";

/** Maximum age (ms) of the handoff flag before we treat it as stale. */
const MAX_AGE_MS = 10_000;

/**
 * Read the handoff flag, consume it, and return whether the current /login
 * visit was triggered by a fresh sign-out.
 *
 * Safe to call multiple times — only the first call within MAX_AGE_MS
 * returns true; subsequent calls (or anything past MAX_AGE_MS) return false.
 */
export function consumeSignoutHandoff(): boolean {
  if (typeof window === "undefined") return false;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(SIGNOUT_HANDOFF_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  // Always remove so the flag is one-shot.
  try {
    window.sessionStorage.removeItem(SIGNOUT_HANDOFF_KEY);
  } catch {
    /* ignore */
  }
  const ts = Number.parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < MAX_AGE_MS;
}
