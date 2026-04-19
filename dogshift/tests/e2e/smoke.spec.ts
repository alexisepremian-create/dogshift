import { expect, test } from "@playwright/test";

// Smoke tests — the bare minimum to catch "the site is completely broken".
// These should be fast, deterministic, and never depend on real data or auth.
// They run against `next start` in CI with dummy env vars, so anything that
// requires real Clerk / Stripe / DB state is intentionally out of scope here.
//
// We deliberately DO NOT assert on <title> here: in React 19 streaming, the
// <title> element can be injected into <head> after Playwright's
// `domcontentloaded` signal fires, which makes the check racy. Instead we
// assert that the server returns a non-error response and that the rendered
// body contains a meaningful amount of text.

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

    const status = response!.status();
    expect(
      status,
      `expected a non-error status for ${route.path}, got ${status}`,
    ).toBeLessThan(400);

    await expect(page.locator("body")).toBeVisible();

    // The page must have rendered *something* substantial — not a blank shell
    // and not a minimal error fallback. 200 chars is well below any real page
    // and well above what an error boundary would emit.
    const bodyText = (await page.locator("body").innerText()).trim();
    expect(
      bodyText.length,
      `expected ${route.path} to render >200 chars of body text, got ${bodyText.length}`,
    ).toBeGreaterThan(200);
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
