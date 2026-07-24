/**
 * Pure decision helper for the credentials login flow.
 *
 * WHY THIS EXISTS — Auth.js v5 (`next-auth@5.0.0-beta`) can resolve
 * `signIn("credentials", { redirect: false })` with `{ error: "CredentialsSignin" }`
 * **even when the JWT session cookie was actually set** server-side. The
 * user-visible bug was: the login form showed "Email ou mot de passe incorrect",
 * yet reloading the page landed the user in their dashboard (because the session
 * cookie was there all along).
 *
 * The fix: never trust `signIn()`'s return value alone. The SESSION is the single
 * source of truth. The caller re-checks the real session (via `getSession()`)
 * whenever `signIn` reports anything other than a clean success, and passes the
 * result here as `hasSession`. See docs/bugs/login-false-invalid-credentials.md.
 */

export type CredentialsSignInResult =
  | { error?: string | null; code?: string | null; ok?: boolean }
  | null
  | undefined;

export type LoginOutcome =
  | "success"
  | "migrated_no_password"
  | "wrong_credentials"
  | "retry";

export function resolveCredentialsLoginOutcome(
  res: CredentialsSignInResult,
  hasSession: boolean,
): LoginOutcome {
  // Clean success straight from signIn().
  if (res && !res.error) return "success";

  // Spurious error from signIn() but a real session exists → the login actually
  // worked. This is the exact case that used to show a false "wrong password".
  if (hasSession) return "success";

  // Account exists but has no DogShift password (Clerk-imported / Google-only):
  // authorize() throws MIGRATED_NO_PASSWORD so we can point the user to reset.
  if (res?.error === "MIGRATED_NO_PASSWORD" || res?.code === "MIGRATED_NO_PASSWORD") {
    return "migrated_no_password";
  }

  // Any other reported error with no session → genuine bad credentials.
  if (res?.error) return "wrong_credentials";

  // No result at all (network/transient) and no session → let the user retry.
  return "retry";
}
