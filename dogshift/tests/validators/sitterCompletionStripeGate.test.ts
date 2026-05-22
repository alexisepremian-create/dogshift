import test from "node:test";
import assert from "node:assert/strict";

import { computeSitterProfileCompletionDetails } from "../../lib/sitterCompletion.ts";

// Regression for the 2026-05-22 publish-toggle-mobile-disabled update:
// users on iOS reported the toggle "doing nothing" even though the May 20 fix
// (aria-disabled + touch-action + early-return) was deployed. Root cause was
// that `stripeConnected` is part of the 8 completion checks — without Stripe
// Connect onboarded, `completionPercent < 100` and the toggle stays
// aria-disabled. The fix surfaces the specific failing checks under the
// toggle; this test locks in the underlying check behaviour so we never
// regress the "Stripe missing → not 100%" rule.

function fullyCompleteProfileExceptStripe() {
  return {
    avatarUrl: "https://r2.example.com/sitters/abc.jpg",
    firstName: "Sysy",
    city: "Montreux",
    address: "Rue Industrielle 30, 1820 Montreux",
    bio: "Garde et balades autour du Lavaux.",
    services: { Promenade: true, Garde: true },
    pricing: { Promenade: 22, Garde: 28 },
    acceptsSmall: true,
    acceptsMedium: true,
    acceptsLarge: true,
    // stripeAccountStatus omitted on purpose.
  };
}

test("stripe not connected → checks.stripeConnected = false, percent < 100", () => {
  const { percent, checks } = computeSitterProfileCompletionDetails(fullyCompleteProfileExceptStripe());
  assert.equal(checks.stripeConnected, false);
  assert.ok(percent < 100, `expected <100, got ${percent}`);
});

test("stripeAccountStatus = PENDING is not enough (must be ENABLED)", () => {
  const profile = { ...fullyCompleteProfileExceptStripe(), stripeAccountStatus: "PENDING" };
  const { checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.stripeConnected, false);
});

test("stripeAccountStatus = ENABLED → checks.stripeConnected = true, percent = 100", () => {
  const profile = { ...fullyCompleteProfileExceptStripe(), stripeAccountStatus: "ENABLED" };
  const { percent, checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.stripeConnected, true);
  assert.equal(percent, 100);
});

test("multiple missing checks each surface independently", () => {
  // Sysy-like case: postal address incomplete (short) + Stripe missing.
  const profile = {
    avatarUrl: "https://r2.example.com/sitters/sysy.jpg",
    firstName: "Sysy",
    city: "Montreux",
    address: "Rue", // too short — fails the 5-char minimum
    bio: "Garde et balades.",
    services: { Promenade: true },
    pricing: { Promenade: 22 },
    acceptsSmall: true,
  };
  const { checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.address, false, "short address must fail");
  assert.equal(checks.stripeConnected, false, "missing stripe must fail");
});
