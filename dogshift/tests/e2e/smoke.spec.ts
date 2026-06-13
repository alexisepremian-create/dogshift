import { expect, test } from "@playwright/test";

// Public route smoke tests — no auth required.
// These run against the Vercel preview URL with real Auth.js/DB/Stripe secrets.
// If any public page returns a 4xx/5xx or renders a blank body, CI fails
// before the PR can auto-merge.

// `minChars` is the minimum visible body text that proves the real page
// committed (vs a blank body / a stuck <PageLoader /> whose content is ~0
// chars). Content pages carry plenty of text (100+). The auth screens
// (/login, /signup) are deliberately MINIMAL — an email-first form with
// icon-only social buttons (no visible label text), ~90 chars total. They
// used to clear the 100-char bar only because the client-rendered cookie
// banner's text happened to be present; on a cold Vercel preview that banner
// commits late, so the bar was flaky. A lower bar for those two routes still
// proves the form rendered (a crashed/blank auth page is ~0 chars) without
// depending on the banner. See docs/bugs/e2e-smoke-body-text-too-short.md.
const PUBLIC_ROUTES = [
  { path: "/", name: "homepage", minChars: 100 },
  { path: "/login", name: "login", minChars: 60 },
  { path: "/signup", name: "signup", minChars: 60 },
  { path: "/devenir-dogsitter", name: "become a sitter landing", minChars: 100 },
  { path: "/dog-sitter-geneve", name: "Geneva SEO page", minChars: 100 },
  { path: "/cgu", name: "CGU", minChars: 100 },
  { path: "/confidentialite", name: "privacy", minChars: 100 },
] as const;

/**
 * Wait for the real page content to commit past any Suspense fallback
 * (e.g. <PageLoader />). We can't rely on the data-page-loader marker
 * because PageLoader is a "use client" component — the attribute only
 * appears AFTER hydration, so an SSR-only check on
 * `!document.querySelector('[data-page-loader="1"]')` returns true
 * immediately even when the loader's markup is in the DOM (which
 * is why PR #368's first attempt still left body at ~63 chars).
 *
 * The pragmatic robust signal is "body has enough text to be a real
 * page". Waits up to 15 s; if the page is truly broken it'll fail the
 * subsequent assertion. A stuck loader is well under `minChars`, so this
 * only resolves once the actual page commits.
 */
async function waitForPageContent(page: import("@playwright/test").Page, minChars: number) {
  await page
    .waitForFunction(
      (min) => document.body.innerText.trim().length > min,
      minChars,
      { timeout: 15_000 },
    )
    .catch(() => undefined); // let the assertion below produce the real error
}

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} (${route.path}) renders without server error`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response, `expected a response for ${route.path}`).not.toBeNull();

    const status = response!.status();
    expect(
      status,
      `expected a non-error status for ${route.path}, got ${status}`,
    ).toBeLessThan(400);

    await expect(page.locator("body")).toBeVisible();
    await waitForPageContent(page, route.minChars);

    const bodyText = (await page.locator("body").innerText()).trim();
    expect(
      bodyText.length,
      `expected ${route.path} to render >${route.minChars} chars of body text, got ${bodyText.length}`,
    ).toBeGreaterThan(route.minChars);
  });
}

test("homepage mentions DogShift", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForPageContent(page, 100);
  await expect(page.locator("body")).toContainText(/DogShift/i);
});

test("unknown route returns 404, not a crash", async ({ page }) => {
  const response = await page.goto("/cette-page-nexiste-pas-xyz");
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(404);
});
