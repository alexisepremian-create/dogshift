import { expect, test } from "@playwright/test";

// Public route smoke tests — no auth required.
// These run against the Vercel preview URL with real Auth.js/DB/Stripe secrets.
// If any public page returns a 4xx/5xx or renders a blank body, CI fails
// before the PR can auto-merge.

const PUBLIC_ROUTES = [
  { path: "/", name: "homepage" },
  { path: "/login", name: "login" },
  { path: "/signup", name: "signup" },
  { path: "/devenir-dogsitter", name: "become a sitter landing" },
  { path: "/dog-sitter-geneve", name: "Geneva SEO page" },
  { path: "/cgu", name: "CGU" },
  { path: "/confidentialite", name: "privacy" },
] as const;

/**
 * Wait for the real page content to commit past any Suspense fallback
 * (e.g. <PageLoader />). We can't rely on the data-page-loader marker
 * because PageLoader is a "use client" component — the attribute only
 * appears AFTER hydration, so an SSR-only check on
 * `!document.querySelector('[data-page-loader="1"]')` returns true
 * immediately even when the loader's SVG markup is in the DOM (which
 * is why PR #368's first attempt still left body at ~63 chars).
 *
 * The pragmatic robust signal is "body has enough text to be a real
 * page". Waits up to 15 s; if the page is truly broken it'll fail the
 * subsequent assertion. PageLoader's content is well under 100 chars,
 * so this only resolves once the actual page commits.
 */
async function waitForPageContent(page: import("@playwright/test").Page) {
  await page
    .waitForFunction(() => document.body.innerText.trim().length > 100, {
      timeout: 15_000,
    })
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
    await waitForPageContent(page);

    const bodyText = (await page.locator("body").innerText()).trim();
    expect(
      bodyText.length,
      `expected ${route.path} to render >100 chars of body text, got ${bodyText.length}`,
    ).toBeGreaterThan(100);
  });
}

test("homepage mentions DogShift", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForPageContent(page);
  await expect(page.locator("body")).toContainText(/DogShift/i);
});

test("unknown route returns 404, not a crash", async ({ page }) => {
  const response = await page.goto("/cette-page-nexiste-pas-xyz");
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(404);
});
