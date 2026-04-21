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
  "/mes-reservations",
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

  // Email input must be visible.
  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 10_000 });

  // The "Continuer" button must be visible.
  await expect(page.getByRole("button", { name: /continuer/i })).toBeVisible();

  // The Google login button must be present.
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
});

test("login form advances to password step after entering a valid email", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 10_000 });

  await emailInput.fill(process.env.PLAYWRIGHT_SITTER_EMAIL ?? "test@dogshift.ch");
  await page.getByRole("button", { name: /continuer/i }).click();

  // After Clerk processes the email, either:
  // a) password field appears (account has password auth) — ideal
  // b) email code field appears (email-only account)
  // c) an error message appears (unknown account) — should not happen with real test account
  //
  // In all success cases, the form changes state — the email submit button disappears.
  await expect(page.getByRole("button", { name: /continuer/i })).not.toBeVisible({
    timeout: 15_000,
  });

  // Either a password field or an email-code field must appear.
  const passwordField = page.locator('input[type="password"]');
  const codeField = page.locator('input[inputmode="numeric"]');
  const eitherVisible = (await passwordField.isVisible()) || (await codeField.isVisible());
  expect(eitherVisible, "expected password or email-code field to appear after email step").toBe(true);
});

test("login form shows an error for a non-existent email", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 10_000 });

  await emailInput.fill("compte-qui-nexiste-vraiment-pas-xyzzy@dogshift-test.invalid");
  await page.getByRole("button", { name: /continuer/i }).click();

  // An error message must appear — not a blank page or a crash.
  const errorText = page.locator("p.text-rose-600, p[class*='rose'], [role='alert']");
  await expect(errorText.first()).toBeVisible({ timeout: 15_000 });
});
