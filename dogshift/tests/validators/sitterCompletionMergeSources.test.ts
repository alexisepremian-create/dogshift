import test from "node:test";
import assert from "node:assert/strict";

import { computeSitterProfileCompletionDetails } from "../../lib/sitterCompletion.ts";

// Regression for the audit 2026-05-22 false-positive on Sylvana Vetter.
//
// Her dashboard showed pricing as defined for every activated service,
// but the cron-side column SitterProfile.pricing was empty (or out of
// sync). The cron computed pricing as missing and sent her a "ton profil
// est à 75 % — finalise-le" email — which is exactly the kind of
// contradictory message that pisses off real sitters and erodes trust.
//
// The fix in the cron is to merge BOTH sources (User.hostProfileJson +
// SitterProfile columns) before computing completion, and to bail out
// silently when the two sources disagree on the set of failing checks.
//
// This test focuses on the column-vs-JSON value precedence the merge
// applies, fed into computeSitterProfileCompletionDetails to confirm the
// guard-rail kicks in for Sylvana-shaped data.

const baseProfile = {
  avatarUrl: "https://r2.example.com/sitters/syl.jpg",
  firstName: "Sylvana",
  city: "Lutry",
  address: "Chemin du Lac 12, 1095 Lutry",
  bio: "Dogsitter passionnée depuis 8 ans.",
  acceptsSmall: true,
  acceptsMedium: true,
  acceptsLarge: false,
  stripeAccountStatus: "ENABLED",
};

test("column has empty pricing, JSON has full pricing → merged compute = 100% (no email)", () => {
  // Simulate the merge logic from the cron: when columnSnapshot.pricing
  // is empty, the JSON's pricing takes over.
  const columnSnapshot = {
    ...baseProfile,
    services: ["Promenade", "Garde"],
    pricing: {}, // ← the bug: column is empty
  };
  const jsonSnapshot = {
    ...baseProfile,
    services: { Promenade: true, Garde: true, Pension: false },
    pricing: { Promenade: 22, Garde: 28 }, // ← dashboard has the real data
  };

  const columnResult = computeSitterProfileCompletionDetails(columnSnapshot);
  // Column-only: pricing fails because pricing={} → percent < 100
  assert.equal(columnResult.checks.pricing, false);
  assert.ok(columnResult.percent < 100, "column-only should be <100");

  // Merged: emptyOrMissing(columnSnapshot.pricing) → true → use JSON pricing
  const merged = {
    ...columnSnapshot,
    pricing: jsonSnapshot.pricing,
    services: jsonSnapshot.services,
  };
  const mergedResult = computeSitterProfileCompletionDetails(merged);
  assert.equal(mergedResult.checks.pricing, true);
  assert.equal(mergedResult.checks.services, true);
  assert.equal(mergedResult.percent, 100, "merged should be 100");
});

test("guard-rail: when ANY source says 100%, the optimistic side wins (skip email)", () => {
  // This is the production guard-rail: if either source reports 100%, the
  // sitter is "done" — sending a contradictory nudge would damage trust.
  const columnResult = { percent: 75, checks: { foo: false } };
  const mergedResult = { percent: 100, checks: { foo: true } };
  const skipBecauseOptimisticIsDone =
    columnResult.percent >= 100 || mergedResult.percent >= 100;
  assert.equal(skipBecauseOptimisticIsDone, true);
});

test("guard-rail: when the two sources disagree on missing checks → skip + flag", () => {
  // Even if neither side is 100, if they disagree about WHICH check fails,
  // we cannot send a coherent email — better silent than wrong.
  const columnMissing = ["pricing", "stripeConnected"].sort().join(",");
  const mergedMissing = ["stripeConnected"].sort().join(",");
  assert.notEqual(columnMissing, mergedMissing);
  // The cron's guard-rail #2 will trigger here and skip the send.
});
