# Clerk v7 email code errors swallowed silently (historical)

**Status:** Resolved + obsolete (DogShift migrated off Clerk in May 2026).
Kept here for historical context — Auth.js v5 has a different error shape.

## Symptom (pre-migration)

During email code (OTP) verification, errors returned by the Clerk v7 API
were not surfaced to the user. The form stayed silent on invalid /
expired / already-used codes.

## Root cause (pre-migration)

Clerk v7 changed the error response structure. The code read
`err.errors[0].message` but v7 sometimes returned errors in a different
shape. The `catch` blocks didn't bubble the error to React state.

## Fix (pre-migration)

- Added `reportApiError()` in the catch blocks
- Used `lib/auth/clerkErrorMessage.ts` to extract the readable message
- Surfaced messages correctly in the UI

## Why this file still matters

If you ever see references to `clerkErrorMessage`, `useClerk`, `useSignIn`,
or any `@clerk/*` import in the current codebase: it's dead code that
needs to be deleted. The Auth.js v5 equivalent is `lib/errors/apiErrorMessage.ts`.

## Related

- Commit `01351c3`, branch `fix/clerk-v7-email-code-silent-errors`
- Clerk fully removed by PRs #316 → #324 (May 2026)
