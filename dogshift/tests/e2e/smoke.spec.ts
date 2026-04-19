import { expect, test } from "@playwright/test";

// Smoke tests — the bare minimum to catch "the site is completely broken".
// These should be fast, deterministic, and never depend on real data or auth.
// They run against `next start` in CI with dummy env vars, so anything that
// requires real Clerk / Stripe / DB state is intentionally out of scope here.

const PUBLIC_ROUTES = [
  { path: "/", name: "homepage" },
  { path: "/login", name: "login" },
  { path: "/signup", name: "signup" },
  { path: "/help", name: "help" },
  { path: "/cgu", name: "CGU" },
  { path: "/confidentialite", name: "privacy" },
  { path: "/dog-sitter-geneve", name: "Geneva SEO page" },
] as const;

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} (${route.path}) renders without server error`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
    expect(response, `expected a response for ${route.path}`).not.toBeNull();
    expect(
      response!.status(),
      `expected non-5xx for ${route.path}, got ${response!.status()}`,
    ).toBeLessThan(500);

    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveTitle(/.+/);
  });
}

test("homepage mentions DogShift", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText(/DogShift/i);
});

test("unknown route returns Next.js 404 page, not a crash", async ({ page }) => {
  const response = await page.goto("/this-page-should-not-exist-xyz", {
    waitUntil: "domcontentloaded",
  });
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(404);
});
