import { expect, test } from "@playwright/test";

// Auth regression tests.
// These lock in the Clerk integration for the most critical flows:
//  - Protected routes redirect to /login (not crash with 500)
//  - Login page renders the email form correctly
//  - Login form advances through email → password step (Clerk API responds)
//
// We do NOT attempt to fully complete a login here because Clerk's
// "client trust" flow may require an email OTP on a new IP/device (i.e. CI),
// which we can't intercept programmatically. The full authenticated flow is
// covered in dashboard.spec.ts which uses a pre-saved Clerk auth state.

const PROTECTED_ROUTES = [
  "/host/profile/edit",
  "/host/profile",
  "/account",
  "/account/bookings",
] as const;

for (const path of PROTECTED_ROUTES) {
  test(`protected route ${path} redirects to /login when unauthenticated`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });

    // Should not be a server error — middleware must redirect, not crash.
    expect(response).not.toBeNull();
    expect(
      response!.status(),
      `${path} must not return a 5xx — got ${response!.status()}`,
    ).toBeLessThan(500);

    // Should end up on the login page after redirect(s).
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
}

test("login page renders the email input and Continuer button", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  // Email input is always rendered (no Clerk dependency).
  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  // The submit button renders as "Chargement…" while Clerk initialises, then
  // switches to "Continuer". We wait for Clerk to finish before asserting text.
  await page.waitForLoadState("networkidle").catch(() => { /* timeout is ok */ });
  // Use .first() because there are multiple buttons on the page that match (Google + email submit).
  await expect(page.getByRole("button", { name: /continuer|chargement/i }).first()).toBeVisible({ timeout: 15_000 });

  // Google button must be present (appears once Clerk client is ready).
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible({ timeout: 15_000 });
});

test("login form advances to password step after entering a valid email", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  // Wait for Clerk to finish initialising so the button is interactive.
  await page.waitForLoadState("networkidle").catch(() => { /* timeout is ok */ });
  const continuerBtn = page.getByRole("button", { name: /continuer/i }).first();
  await expect(continuerBtn).toBeVisible({ timeout: 15_000 });

  // Use the owner email — we know it exists in Clerk (global-setup confirmed it).
  // Clerk never hides the submit button — it disables it while processing then
  // shows a new step. So we do NOT wait for the button to disappear; instead we
  // wait for the next-step input to appear (password or OTP code field).
  const email = process.env.PLAYWRIGHT_OWNER_EMAIL ?? process.env.PLAYWRIGHT_SITTER_EMAIL ?? "test@dogshift.ch";
  await emailInput.fill(email);
  await continuerBtn.click();

  // After Clerk processes the email one of these appears:
  //   a) password field  — account has password auth
  //   b) numeric code field — email-code / OTP account
  // Both confirm Clerk accepted the email and advanced the form.
  const passwordField = page.locator('input[type="password"]');
  const codeField = page.locator('input[inputmode="numeric"]');

  // Wait up to 20s for either field to become visible.
  await Promise.race([
    passwordField.waitFor({ state: "visible", timeout: 20_000 }),
    codeField.waitFor({ state: "visible", timeout: 20_000 }),
  ]).catch(() => { /* will be caught by assertion below */ });

  const eitherVisible = (await passwordField.isVisible()) || (await codeField.isVisible());
  expect(eitherVisible, "expected password or email-code field to appear after email step").toBe(true);
});

test("login form shows an error for a non-existent email", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  await page.waitForLoadState("networkidle").catch(() => { /* timeout is ok */ });
  const continuerBtn = page.getByRole("button", { name: /continuer/i }).first();
  await expect(continuerBtn).toBeVisible({ timeout: 15_000 });

  await emailInput.fill("compte-qui-nexiste-vraiment-pas-xyzzy@dogshift-test.invalid");
  await continuerBtn.click();

  // An error message must appear — not a blank page or a crash.
  const errorText = page.locator("p.text-rose-600, p[class*='rose'], [role='alert']");
  await expect(errorText.first()).toBeVisible({ timeout: 15_000 });
});
