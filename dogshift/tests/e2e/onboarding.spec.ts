import { expect, test } from "@playwright/test";

// Onboarding regression tests.
// These lock in the "devenir dogsitter" flow that blocked Nathalie (PR #13).
//
// The multi-step form at /become-sitter/form requires an invite cookie, so
// we can't navigate there directly without it. Instead we test:
//  - The landing page (/devenir-dogsitter) renders and has a CTA
//  - Without the invite cookie, /become-sitter/form redirects to landing
//
// Full step-2 validation tests are covered in unit tests
// (tests/validators/hostProfileUpdateSchema.test.ts).

test("devenir-dogsitter landing page renders with a call-to-action", async ({ page }) => {
  // This page is "use client" — wait for JS to hydrate before reading body text.
  await page.goto("/devenir-dogsitter", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => { /* timeout is ok */ });

  // The page should mention becoming a sitter in some way.
  // Use toContainText with a timeout so Playwright waits for the client render.
  await expect(page.locator("body")).toContainText(/dogsitter|dog.sitter|devenir|sitter/i, {
    timeout: 15_000,
  });
});

test("become-sitter/form redirects to /devenir-dogsitter without invite cookie", async ({
  page,
}) => {
  // Navigate without the ds_invite_unlocked=1 cookie → should redirect.
  await page.goto("/become-sitter/form", { waitUntil: "domcontentloaded" });

  // Should end up back on the landing page.
  await page.waitForURL(/devenir-dogsitter/, { timeout: 10_000 });
  expect(page.url()).toContain("devenir-dogsitter");
});

test("become-sitter/form renders step 1 with invite cookie set", async ({ page, context }) => {
  // Set the invite cookie that unlocks the form.
  await context.addCookies([
    {
      name: "ds_invite_unlocked",
      value: "1",
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").hostname,
      path: "/",
    },
  ]);

  const response = await page.goto("/become-sitter/form", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(400);

  // Step 1 must contain name fields or a "continuer" button.
  const body = await page.locator("body").innerText();
  expect(body.length).toBeGreaterThan(100);

  // The form or its first step should be visible.
  await expect(page.locator("body")).toContainText(/prénom|nom|continuer|étape/i);
});
