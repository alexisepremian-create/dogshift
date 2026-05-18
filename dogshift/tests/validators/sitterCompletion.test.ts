import test from "node:test";
import assert from "node:assert/strict";

import {
  computeSitterProfileCompletion,
  computeSitterProfileCompletionDetails,
} from "../../lib/sitterCompletion.ts";

// Profile that satisfies all 7 pre-Phase-3 checks (everything except address).
// Used as the baseline against which we verify that adding/removing `address`
// flips just the `address` check without breaking the others.
function fullyCompleteProfileSansAddress() {
  return {
    avatarUrl: "https://r2.example.com/sitters/abc.jpg",
    firstName: "Sonia",
    city: "Morges",
    bio: "Passionnée des chiens depuis 10 ans.",
    services: { Promenade: true, Garde: true },
    pricing: { Promenade: 20, Garde: 25 },
    acceptsSmall: true,
    acceptsMedium: true,
    acceptsLarge: false,
    stripeAccountStatus: "ENABLED",
  };
}

test("computeSitterProfileCompletion: 8/8 checks when address is filled (100%)", () => {
  const profile = {
    ...fullyCompleteProfileSansAddress(),
    address: "Rue du Lac 35",
  };
  const { percent, checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.address, true);
  assert.equal(percent, 100);
});

test("computeSitterProfileCompletion: address absent → blocks the 100%", () => {
  const profile = fullyCompleteProfileSansAddress();
  const { percent, checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.address, false);
  // 7 of 8 checks passing = 88%
  assert.equal(percent, 88);
});

test("computeSitterProfileCompletion: too-short address (< 5 chars) does NOT count", () => {
  const profile = {
    ...fullyCompleteProfileSansAddress(),
    address: "Rue",
  };
  const { checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.address, false);
});

test("computeSitterProfileCompletion: whitespace-only address does NOT count", () => {
  const profile = {
    ...fullyCompleteProfileSansAddress(),
    address: "   ",
  };
  const { checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.address, false);
});

test("computeSitterProfileCompletion: address null behaves like missing field", () => {
  const profile = {
    ...fullyCompleteProfileSansAddress(),
    address: null,
  };
  const { checks, percent } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.address, false);
  assert.equal(percent, 88);
});

test("computeSitterProfileCompletion: bare wrapper returns just the percent", () => {
  const profile = {
    ...fullyCompleteProfileSansAddress(),
    address: "Chemin de la Vaux 21B",
  };
  assert.equal(computeSitterProfileCompletion(profile), 100);
});
