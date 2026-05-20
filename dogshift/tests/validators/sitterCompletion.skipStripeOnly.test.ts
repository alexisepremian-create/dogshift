import test from "node:test";
import assert from "node:assert/strict";

import { computeSitterProfileCompletionDetails } from "../../lib/sitterCompletion.ts";

/**
 * Regression test for docs/bugs/onboarding-nudge-stripe-only.md.
 *
 * Locks in the rule used by /api/cron/sitter-onboarding-nudge to skip
 * sitters whose ONLY missing check is Stripe Connect. Stripe Connect is
 * an external onboarding step (bank account verification) surfaced
 * separately on the dashboard — sending the generic "finalize your
 * profile" nudge to a sitter at 7/8 is misleading.
 */

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    avatarUrl: "https://example.com/avatar.jpg",
    firstName: "Sylvana",
    city: "Montreux",
    address: "Rue Industrielle 30",
    bio: "Je prendrai bien soin de votre animal.",
    services: { Promenade: true },
    pricing: { Promenade: 20 },
    acceptsSmall: true,
    acceptsMedium: true,
    acceptsLarge: false,
    stripeAccountStatus: "ENABLED",
    ...overrides,
  };
}

test("when only stripeConnected is missing → percent is 87 (7/8)", () => {
  const profile = makeProfile({ stripeAccountStatus: null });
  const { percent, checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.stripeConnected, false);
  assert.equal(checks.avatar, true);
  assert.equal(checks.identity, true);
  assert.equal(checks.address, true);
  assert.equal(checks.bio, true);
  assert.equal(checks.services, true);
  assert.equal(checks.pricing, true);
  assert.equal(checks.dogSizes, true);
  // 7 out of 8 → Math.round(87.5) = 88 in JS
  assert.equal(percent, 88);
});

test("isolation rule : sitter at 7/8 with ONLY stripe missing must be detectable in 1 expression", () => {
  // This mirrors the exact rule used in app/api/cron/sitter-onboarding-nudge/route.ts.
  // If this assertion ever breaks, double-check the cron skip logic.
  const profile = makeProfile({ stripeAccountStatus: null });
  const { checks } = computeSitterProfileCompletionDetails(profile);
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  assert.deepEqual(missing, ["stripeConnected"]);
  assert.equal(missing.length === 1 && missing[0] === "stripeConnected", true);
});

test("when avatar AND stripe missing → skip rule does NOT trigger (regular nudge OK)", () => {
  const profile = makeProfile({ avatarUrl: null, stripeAccountStatus: null });
  const { checks } = computeSitterProfileCompletionDetails(profile);
  const missing: string[] = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  assert.equal(missing.length, 2);
  assert.equal(missing.includes("stripeConnected"), true);
  assert.equal(missing.includes("avatar"), true);
  // Skip rule requires length === 1 — this sitter should still get the nudge.
  const missingLength: number = missing.length;
  const skipRule = missingLength === 1 && missing[0] === "stripeConnected";
  assert.equal(skipRule, false);
});

test("when ONLY bio is missing → skip rule does NOT trigger (Stripe is the exception, not other fields)", () => {
  const profile = makeProfile({ bio: "" });
  const { checks } = computeSitterProfileCompletionDetails(profile);
  const missing: string[] = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  assert.deepEqual(missing, ["bio"]);
  const missingFirst: string | undefined = missing[0];
  const skipRule = missing.length === 1 && missingFirst === "stripeConnected";
  assert.equal(skipRule, false);
});

test("full profile (8/8) → percent 100 and no missing checks", () => {
  const profile = makeProfile();
  const { percent, checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(percent, 100);
  const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  assert.deepEqual(missing, []);
});
