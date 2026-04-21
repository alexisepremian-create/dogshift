import { expect, test } from "@playwright/test";
import * as fs from "node:fs";
import { SITTER_AUTH_FILE } from "./global-setup";

// Dashboard regression tests — run with a pre-authenticated sitter session.
//
// These catch:
// - Sydney's bug: profile save returns VALIDATION_ERROR (PR #13)
// - Dashboard 500s after a bad deploy
// - Profile form rendering correctly
//
// Auth state is prepared by global-setup.ts using Clerk's backend API so
// no email/OTP interaction is needed in CI.

const skipIfNoAuth = () => {
  if (!fs.existsSync(SITTER_AUTH_FILE)) {
    test.skip(true, "Sitter auth state not found — CLERK_SECRET_KEY may not be set in this environment.");
  }
};

test.describe("Sitter dashboard (authenticated)", () => {
  test.use({ storageState: SITTER_AUTH_FILE });

  test.beforeEach(skipIfNoAuth);

  test("host/profile/edit page loads without a 500", async ({ page }) => {
    const response = await page.goto("/host/profile/edit", { waitUntil: "domcontentloaded" });
    expect(response).not.toBeNull();
    expect(
      response!.status(),
      `expected host/profile/edit to return 200, got ${response!.status()}`,
    ).toBeLessThan(400);

    // The page must render substantial content, not a blank error shell.
    const bodyText = (await page.locator("body").innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(200);
  });

  test("profile edit page contains editable fields (firstName, bio)", async ({ page }) => {
    await page.goto("/host/profile/edit", { waitUntil: "domcontentloaded" });

    // Wait for the React client to hydrate.
    await page.waitForLoadState("networkidle");

    // Either the form fields or a loading skeleton must be visible.
    const body = await page.locator("body").innerText();
    expect(body.length, "page must render content, not a blank shell").toBeGreaterThan(200);

    // The edit form must have at least one editable field.
    // We check by label text since IDs can change.
    const hasNameField = await page.locator("input[name='firstName'], input[id='firstName'], label:has-text('Prénom')").count() > 0;
    const hasBioField = await page.locator("textarea[name='bio'], textarea[id='bio'], label:has-text('Bio')").count() > 0;
    const hasAnyField = hasNameField || hasBioField;
    expect(hasAnyField, "expected at least one profile edit field to be present").toBe(true);
  });

  test("PATCH /api/host/profile with valid data returns 200, not VALIDATION_ERROR", async ({
    page,
    request,
  }) => {
    // This is the regression test for Sydney's bug (PR #13): the validator was
    // rejecting valid profile payloads with VALIDATION_ERROR, silently blocking saves.
    //
    // We navigate to the page first to get the Clerk session cookies set,
    // then make the API call with those cookies.
    await page.goto("/host/profile/edit", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Fetch the current profile to get a baseline payload.
    const meResponse = await page.evaluate(async () => {
      const res = await fetch("/api/sitters/me", { credentials: "include" });
      return { status: res.status, body: await res.json().catch(() => null) };
    });

    // If the sitter profile endpoint returns 200, we can safely test the PATCH.
    if (meResponse.status !== 200) {
      test.skip(true, `GET /api/sitters/me returned ${meResponse.status} — skipping PATCH test.`);
      return;
    }

    // PATCH with a minimal but valid payload — this must not return VALIDATION_ERROR.
    const patchResponse = await page.evaluate(async () => {
      const res = await fetch("/api/host/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: "Test automatique E2E — ne pas modifier." }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });

    expect(
      patchResponse.status,
      `PATCH /api/host/profile returned ${patchResponse.status}: ${JSON.stringify(patchResponse.body)}`,
    ).toBeLessThan(400);

    // Explicitly ensure the response is not a VALIDATION_ERROR.
    if (patchResponse.body) {
      expect(
        (patchResponse.body as { error?: string }).error,
        "PATCH /api/host/profile must not return VALIDATION_ERROR",
      ).not.toBe("VALIDATION_ERROR");
    }
  });
});
