---
name: playwright-auth
description: Re-enable or extend Playwright authenticated e2e tests in DogShift. Use when the user asks to reactivate auth e2e (currently skipped post-Clerk migration), or to add Playwright tests that require a logged-in session.
---

# Playwright auth — DogShift

## Current state

**Auth e2e tests are SKIPPED.** Since the Clerk → Auth.js migration (May 2026), `tests/e2e/global-setup.ts` no longer creates storage-state files. Tests in `tests/e2e/auth.spec.ts` self-skip when those files are absent.

Why : the old setup used `clerk.dev`'s admin API to create a session token directly. Auth.js v5 has no equivalent admin endpoint — session creation needs either UI-driven login or direct Prisma writes.

## Two ways to re-enable

### Option A : Drive UI login flow (slow, brittle)

```ts
// tests/e2e/global-setup.ts
async function login(page, email, password) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("/post-login");
}
```

Pros : tests the real flow.
Cons : slow (~3-5 s per session), flaky (any login UI change breaks setup), requires test users in prod-shaped DB.

### Option B : Insert Session row via Prisma (fast, robust) ← recommended

Auth.js JWT sessions don't write to the `Session` table. We use a different approach :

1. Create a test user in the DB (or look up an existing one)
2. Generate a JWT manually with the same `AUTH_SECRET` Vercel uses
3. Inject it as a cookie in the browser context

```ts
import { encode } from "next-auth/jwt";

async function authenticateAs(context, userId, email, role) {
  const token = await encode({
    token: { sub: userId, email, role, name: "Test" },
    secret: process.env.AUTH_SECRET,
    salt: "authjs.session-token",  // matches Auth.js v5 internal naming
  });

  await context.addCookies([{
    name: "__Secure-authjs.session-token",
    value: token,
    domain: "www.dogshift.ch",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  }]);
}
```

Pros : sub-100ms, no UI dependency, deterministic.
Cons : requires AUTH_SECRET in CI (already needed for Vercel anyway), bypasses real login flow (so login UI bugs go uncaught).

**Recommended pattern** : Option B for `global-setup`, plus ONE test that drives Option A end-to-end → covers the login UI.

## Test fixtures

Set up reusable contexts in `playwright.config.ts` :

```ts
{
  projects: [
    {
      name: "anonymous",
      use: { storageState: undefined },
    },
    {
      name: "logged-in-owner",
      use: { storageState: "tests/e2e/.auth/owner.json" },
    },
    {
      name: "logged-in-sitter",
      use: { storageState: "tests/e2e/.auth/sitter.json" },
    },
  ],
}
```

`global-setup.ts` writes the storage states once → tests reuse them in parallel without re-authenticating.

## Required env vars (CI + local)

```bash
AUTH_SECRET=                 # MUST match Vercel value
PLAYWRIGHT_OWNER_EMAIL=
PLAYWRIGHT_OWNER_PASSWORD=
PLAYWRIGHT_SITTER_EMAIL=
PLAYWRIGHT_SITTER_PASSWORD=
PLAYWRIGHT_BASE_URL=
VERCEL_AUTOMATION_BYPASS_SECRET=
```

These are GitHub Actions secrets for the `e2e` CI job. Locally, copy from Vercel.

## Test users in the DB

The DB needs at least one OWNER and one SITTER user that match the email/password env vars. Two options :

### Option 1 : Seed script

`scripts/e2e-seed-users.ts` — idempotent : creates the users if missing, leaves them otherwise. Run once before the test suite.

### Option 2 : Inline fixture

Setup script creates users on first run, deletes them on teardown. Cleaner but slower.

For pilot phase : Option 1 + dedicated "playwright-owner@dogshift.ch" / "playwright-sitter@dogshift.ch" accounts that never get deleted.

## Gotchas

### Cookie name varies by HTTPS/HTTP

- HTTPS : `__Secure-authjs.session-token` (preferred)
- HTTP (localhost) : `authjs.session-token`

Detect via `process.env.PLAYWRIGHT_BASE_URL?.startsWith("https")`.

### `domain` cookie attribute matters

- `www.dogshift.ch` for prod
- `localhost` for local dev (no leading dot)
- Vercel preview : the random `dogshift-pr-XYZ.vercel.app` subdomain

Pass the right one or the cookie doesn't apply.

### Sitter vs owner role propagation

After role is changed (via admin or `/api/role/make-sitter`), the JWT still holds the OLD role for 30 days. To test "sitter-only" routes, ensure the test user's role in DB is `SITTER` BEFORE generating the JWT — the JWT callback re-reads role from DB on every request, so a freshly generated token will have the right role.

### Browser context isolation

Always create a new `browserContext` per test (don't share auth state across tests) — Playwright's default. If you reuse a context, one test's logout affects another's.

## What NOT to do

- ❌ Hardcode user IDs in tests — use env vars or look up by email
- ❌ Run e2e tests against prod with real user accounts — use dedicated playwright-* accounts
- ❌ Skip `await context.addCookies()` and try `localStorage` — Auth.js cookies are HttpOnly, can't be set client-side
- ❌ Try to mock Auth.js — the lib's tight integration with Next.js makes mocking brittle
- ❌ Run logged-in tests in parallel with the same user (race conditions on session refresh)
- ❌ Forget `httpOnly: true` and `secure: true` on the cookie — Auth.js rejects insecure cookies

## Reactivation checklist

When the user says "réactive les e2e auth" :

1. Decide Option A vs Option B (recommend B)
2. Implement `global-setup.ts` properly (currently it's a no-op)
3. Create seed script if needed
4. Add the env vars to GitHub Actions secrets
5. Un-skip `tests/e2e/auth.spec.ts`
6. Add ONE end-to-end UI login test (covers login UI bugs)
7. Verify CI is green on a draft PR before merging
8. Update `docs/AUTH.md` §Tests with the new approach

## Where to look

- `tests/e2e/global-setup.ts` — currently no-op, target file
- `tests/e2e/auth.spec.ts` — skipped specs to reactivate
- `playwright.config.ts` — project configs
- `docs/AUTH.md` §Tests — current state doc
- `auth.ts` — for the JWT encode signature reference
- `.github/workflows/ci.yml` — e2e job that wires secrets
