---
name: e2e-playwright
description: Write or debug a Playwright end-to-end test in DogShift (tests/e2e/, runs against Vercel preview). Use when adding browser-level tests, debugging CI smoke failures, or when the user mentions Playwright / e2e / smoke test issues.
---

# Playwright e2e — DogShift

## Layout

- **Folder** : `tests/e2e/`
- **Config** : `playwright.config.ts`
- **Smoke entry** : `tests/e2e/smoke.spec.ts`
- **Auth e2e** : `tests/e2e/auth.spec.ts` — currently skipped (see history below)
- **Runs against** : Vercel preview deployment URL passed via `PLAYWRIGHT_BASE_URL` env
- **Bypass header** : `x-vercel-protection-bypass` (auto-set by `tests/e2e/global-setup.ts`)
- **NOT in `npm test`** — only in CI's `e2e` job (`gh pr view`), runs after `quality` passes

## When to add a test

- Critical user flow (signup, login, booking, payment) — yes
- New marketing page that should render server-side — yes
- API endpoint behavior — **no**, use unit test in `tests/integrations/`
- Visual regression — **no**, Playwright is for behavior

## Smoke template

```ts
import { test, expect } from "@playwright/test";

test("homepage renders with sitter list", async ({ page }) => {
  await page.goto("/");

  // Wait for SSR content (NOT networkidle — sockets can hang)
  await page.waitForLoadState("domcontentloaded");

  // Assert real body content (catches blank pages)
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length).toBeGreaterThan(100);

  // Assert specific element
  await expect(page.locator("h1")).toContainText("Trouve un dogsitter");
});
```

## Critical gotchas (learned the hard way)

### 1. Suspense fallback never resolves on preview

**Symptom** : test gets ~63 chars body innerText (a logo loader), times out at 15 s.

**Cause** : Vercel preview + Neon cold start + initial sitter query latency = Suspense boundary doesn't resolve in 15 s.

**Fix** : Marketing routes' `loading.tsx` MUST return `null`, not `<PageLoader />`. Footer flash is handled by the static `<NavigationOverlay />` + MutationObserver, not by Suspense fallback.

See `docs/bugs/e2e-smoke-body-text-too-short.md` for the full saga (PRs #359 → #368 → #371 → revert).

### 2. Don't wait on client-component-added DOM attributes

```ts
// ❌ BAD — `data-page-loader="1"` is added by React AFTER hydration.
// At domcontentloaded the attribute doesn't exist yet → wait resolves
// immediately → assertion runs on the loader content.
await page.locator('[data-page-loader="1"]').waitFor({ state: "detached" });

// ✅ GOOD — wait for actual content
await page.waitForFunction(() => document.body.innerText.length > 100, { timeout: 15000 });
```

### 3. Don't blindly swap `domcontentloaded` → `networkidle`

`networkidle` hangs on pages with long-polling sockets (Stripe, Sentry, etc.). Use `domcontentloaded` and explicit content waits.

### 4. Auth e2e is currently skipped

`tests/e2e/global-setup.ts` no longer creates storage states (Clerk → Auth.js migration). Auth tests skip themselves when storage-state files are absent. To re-enable :
- Drive UI login flow (slow, brittle)
- OR insert a Session row directly via Prisma in setup (faster)

## Running locally

```bash
# Install Playwright browsers (once)
npx playwright install chromium

# Run against local dev
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test

# Run a single file
npx playwright test tests/e2e/smoke.spec.ts

# Open headed for debugging
npx playwright test --headed --debug

# Show last run report
npx playwright show-report
```

## Running against a preview

```bash
PLAYWRIGHT_BASE_URL=https://dogshift-pr-XYZ.vercel.app \
VERCEL_AUTOMATION_BYPASS_SECRET=$(grep ^VERCEL_AUTOMATION_BYPASS_SECRET .env.local | cut -d= -f2-) \
npx playwright test
```

The `global-setup.ts` injects `x-vercel-protection-bypass` so the test reaches the real app (bypassing Vercel's preview password wall).

## What NOT to do

- ❌ Lower the `>100 chars body text` smoke threshold — it's the only catch for blank pages
- ❌ Replace `domcontentloaded` with `networkidle` blindly
- ❌ Wait for client-component-added DOM attributes
- ❌ Add `<PageLoader />` to `loading.tsx` for routes covered by smoke
- ❌ Hardcode prod URLs — always `PLAYWRIGHT_BASE_URL`
- ❌ Use real Stripe / Clerk in tests — mock at the API boundary or skip

## When CI smoke fails on a PR not related to that route

Likely a Suspense / loading issue. Check `docs/bugs/e2e-smoke-body-text-too-short.md` first before assuming the test is flaky.

## Where to look

- `tests/e2e/smoke.spec.ts` — minimal smoke entry, copy as starting point
- `tests/e2e/auth.spec.ts` — auth flow (currently skipped)
- `playwright.config.ts` — timeouts, retry, base URL config
- `docs/bugs/e2e-smoke-body-text-too-short.md` — playbook for the recurring smoke false positive
- `.github/workflows/ci.yml` — `e2e` job that wires it into PR gating
