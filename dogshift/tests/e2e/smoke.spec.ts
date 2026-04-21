import { expect, test } from "@playwright/test";

// Public route smoke tests — no auth required.
// These run against the Vercel preview URL with real Clerk/DB/Stripe secrets.
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

    const bodyText = (await page.locator("body").innerText()).trim();
    expect(
      bodyText.length,
      `expected ${route.path} to render >100 chars of body text, got ${bodyText.length}`,
    ).toBeGreaterThan(100);
  });
}

test("homepage mentions DogShift", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toContainText(/DogShift/i);
});

test("unknown route returns 404, not a crash", async ({ page }) => {
  const response = await page.goto("/cette-page-nexiste-pas-xyz");
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(404);
});
