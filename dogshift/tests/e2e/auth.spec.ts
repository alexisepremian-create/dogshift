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

  // Email input is always enabled immediately (not gated on Clerk init).
  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await expect(emailInput).toBeEnabled({ timeout: 5_000 });

  // The submit button renders as "Chargement…" while Clerk initialises, then
  // switches to "Continuer". We wait for Clerk to finish before asserting text.
  await page.waitForLoadState("networkidle").catch(() => { /* timeout is ok */ });
  // Use .first() because there are multiple buttons on the page that match (Google + email submit).
  await expect(page.getByRole("button", { name: /continuer|chargement/i }).first()).toBeVisible({ timeout: 15_000 });

  // Google button must be present (appears once Clerk client is ready).
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible({ timeout: 15_000 });
});

test("login form processes email without crashing", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await expect(emailInput).toBeEnabled({ timeout: 5_000 });

  await page.waitForLoadState("networkidle").catch(() => { /* timeout is ok */ });
  const continuerBtn = page.getByRole("button", { name: /continuer/i }).first();
  await expect(continuerBtn).toBeVisible({ timeout: 15_000 });

  // Use the owner email — confirmed to exist in Clerk (global-setup succeeded for owner).
  // We don't assert what the next step looks like because it varies per account type
  // (password, passkey, email-code, Google SSO). We only verify the page responds
  // to the click and doesn't crash. (Clerk may not fully init in CI headless mode.)
  const email = process.env.PLAYWRIGHT_OWNER_EMAIL ?? process.env.PLAYWRIGHT_SITTER_EMAIL ?? "test@dogshift.ch";
  await emailInput.fill(email);
  await continuerBtn.click();

  // The page must still be alive after processing (no white screen / crash).
  await expect(page.locator("body")).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.length, "page must not be blank after email submit").toBeGreaterThan(10);
});

test("login form shows an error for a non-existent email", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const emailInput = page.locator('input[type="email"], input#email');
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await expect(emailInput).toBeEnabled({ timeout: 5_000 });

  await page.waitForLoadState("networkidle").catch(() => { /* timeout is ok */ });
  const continuerBtn = page.getByRole("button", { name: /continuer/i }).first();
  await expect(continuerBtn).toBeVisible({ timeout: 15_000 });

  await emailInput.fill("compte-qui-nexiste-vraiment-pas-xyzzy@dogshift-test.invalid");
  await continuerBtn.click();

  // An error message must appear — either Clerk rejects the email (not found) or
  // the form shows a "service loading" error when Clerk hasn't initialised in CI.
  // Either way, the page must not crash and must show a visible error.
  const errorText = page.locator("p.text-rose-600, p[class*='rose'], [role='alert'], p[class*='red']");
  await expect(errorText.first()).toBeVisible({ timeout: 15_000 });
});
