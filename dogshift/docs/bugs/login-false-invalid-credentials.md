# Login shows "Email ou mot de passe incorrect" but the user IS logged in

**Status:** Fixed (2026-07-24)

## Symptom

User enters correct email + password on `/login`, clicks "Se connecter".
The form shows the red error **"Email ou mot de passe incorrect."** — but
if the user simply **reloads the page**, they are redirected straight into
their dashboard (they were authenticated all along). Reported as: "quand
j'essaie de me connecter ça me met mot de passe incorrect mais quand je
recharge la page ça me redirige vers mon compte".

## Root cause

`components/auth/AuthFlow.tsx` treated the return value of
`signIn("credentials", { redirect: false })` as the single source of truth:

```ts
const res = await signIn("credentials", { email, password, redirect: false });
if (res.error) {
  if (res.error === "CredentialsSignin") setError("Email ou mot de passe incorrect.");
  // ...
  return;
}
router.replace(callbackUrl);
```

With **Auth.js v5** (`next-auth@5.0.0-beta`) + the **Credentials provider** +
**JWT session strategy**, `signIn(..., { redirect: false })` can resolve with
`{ error: "CredentialsSignin", ok: false }` **even when authentication
succeeded and the JWT session cookie was already Set-Cookie'd** by the
`/api/auth/callback/credentials` response. So:

- Server: `authorize()` returns the user → `jwt` callback builds the token →
  the session cookie is written. **The user is logged in.**
- Client: `signIn()` resolves with a spurious `error`, the UI shows "wrong
  password", and never redirects.
- Reload: the SessionProvider reads the (already present) cookie via
  `/api/auth/session` → the user is authenticated → `/login`'s auto-redirect
  sends them to `/post-login` → dashboard. Hence "reload fixes it".

A Cloudflare "Managed Challenge" rule that used to match `/api/auth` made this
worse (challenge HTML returned instead of JSON on the signIn POST), but the
race exists purely from the Auth.js beta behaviour and must be fixed in code.

## Fix

The **session is the single source of truth**, not `signIn()`'s return value.

1. New pure helper `lib/auth/loginOutcome.ts` →
   `resolveCredentialsLoginOutcome(res, hasSession)` returns
   `success | migrated_no_password | wrong_credentials | retry`.
   - A result with **no `error`** → `success`.
   - **Any** reported error **but a real session exists** → `success`
     (this is the bug case).
   - `MIGRATED_NO_PASSWORD` (via `error` or `code`) + no session → tell the
     user to reset their password.
   - Other error + no session → `wrong_credentials`.
   - No result + no session → `retry`.
2. In `AuthFlow.tsx` (`handleLogin` **and** the post-signup auto-login
   `handleSignup`): whenever `signIn` reports anything other than a clean
   success, re-check the real session with `getSession()` from
   `next-auth/react` **before** showing any failure:

   ```ts
   const res = await signIn("credentials", { email, password, redirect: false });
   const hasSession = res && !res.error ? true : Boolean((await getSession())?.user);
   const outcome = resolveCredentialsLoginOutcome(res, hasSession);
   if (outcome === "success") { router.replace(callbackUrl); return; }
   // ...map genuine failures only when there is truly no session
   ```

`getSession()` fetches `/api/auth/session` fresh (the signIn POST's Set-Cookie
is already applied to the browser jar before its promise resolves), so it
reliably reflects the real auth state. It is only called on the error path, so
the happy path stays a single round-trip.

Regression test: `tests/auth/loginOutcome.test.ts` — asserts the exact bug
case (`{ error: "CredentialsSignin" }` + session present → `success`) plus the
genuine-failure and migrated-account paths.

## How to recognize a regression of this

- "Wrong password" shown on a correct login, but a page reload lands the user
  in the dashboard.
- Any code that maps `signIn("credentials", { redirect: false })`'s `.error`
  to a UI message **without** first confirming there is no session via
  `getSession()`. Always route the decision through
  `resolveCredentialsLoginOutcome`.

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Race is client-side in the Auth.js beta signIn() return value; not observable via an HTTP probe (the /login HTML is identical whether or not the bug is present — the logic lives in a client JS chunk). The real scenario (correct credentials → no false error → redirect) requires a Playwright session with valid creds, covered by tests/e2e/auth.spec.ts, and the decision logic is unit-tested in tests/auth/loginOutcome.test.ts."
}
```
