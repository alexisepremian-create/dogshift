/**
 * Pure routing decision for the email-first auth flow (components/auth/AuthFlow.tsx).
 *
 * Maps the /api/auth/check-email response to the next UI step:
 *   - new email                       → "signup"
 *   - existing account (has password) → "login"
 *   - existing account (no password)  → "login" (UI then shows the Google/reset hint)
 *
 * Kept in its own React-free module so it can be unit-tested by the node test
 * runner without pulling in client-only imports.
 */
export type AuthStep = "email" | "login" | "signup";

export function decideAuthStep(input: { exists: boolean; hasPassword: boolean }): AuthStep {
  if (!input.exists) return "signup";
  return "login";
}
