import test from "node:test";
import assert from "node:assert/strict";

import { computeSitterProfileCompletionDetails } from "../../lib/sitterCompletion.ts";

// Regression for audit 2026-05-22 (the dashboard-vs-cron divergence):
//
//   - Dashboard / User.hostProfileJson stores `services` as a boolean record:
//       { Promenade: true, Garde: true, Pension: false }
//   - SitterProfile.services column stores `services` as an array of names:
//       ["Promenade", "Garde"]
//
// Both shapes appear in production data. Before this fix the function only
// understood the boolean-record shape, so cron iterations that read the column
// computed `pricing: false` (Object.keys on an array returns the indices "0",
// "1" which never match the pricing record keys → pricing[]undefined → fail).
//
// The two shapes MUST now produce identical {percent, checks} when the
// underlying intent is the same.

const baseAddressEtc = {
  avatarUrl: "https://r2.example.com/sitters/foo.jpg",
  firstName: "Sitter",
  city: "Lutry",
  address: "Chemin d'Orzens 40, 1095 Lutry",
  bio: "Garde sérieuse depuis 5 ans.",
  pricing: { Promenade: 20, Garde: 26 },
  acceptsSmall: true,
  acceptsMedium: true,
  acceptsLarge: false,
  stripeAccountStatus: "ENABLED",
};

test("services as boolean record AND as array of names yield identical results", () => {
  const asRecord = {
    ...baseAddressEtc,
    services: { Promenade: true, Garde: true, Pension: false },
  };
  const asArray = {
    ...baseAddressEtc,
    services: ["Promenade", "Garde"],
  };

  const a = computeSitterProfileCompletionDetails(asRecord);
  const b = computeSitterProfileCompletionDetails(asArray);

  assert.equal(a.percent, b.percent, "percent must match between shapes");
  assert.equal(a.checks.services, true);
  assert.equal(b.checks.services, true, "array shape must still flag services as filled");
  assert.equal(a.checks.pricing, true);
  assert.equal(b.checks.pricing, true, "array shape must NOT silently fail pricing");
  assert.equal(a.percent, 100);
  assert.equal(b.percent, 100);
});

test("services array with a name that has no pricing fails pricing (parity with record shape)", () => {
  const asRecord = {
    ...baseAddressEtc,
    services: { Promenade: true, Garde: true },
    pricing: { Promenade: 20 }, // Garde missing on purpose
  };
  const asArray = {
    ...baseAddressEtc,
    services: ["Promenade", "Garde"],
    pricing: { Promenade: 20 },
  };

  const a = computeSitterProfileCompletionDetails(asRecord);
  const b = computeSitterProfileCompletionDetails(asArray);

  assert.equal(a.checks.pricing, false);
  assert.equal(b.checks.pricing, false);
  assert.equal(a.percent, b.percent);
});

test("dogSizes also accepts array shape (parity with services)", () => {
  const profile = {
    ...baseAddressEtc,
    services: { Promenade: true },
    pricing: { Promenade: 20 },
    // legacy/columns-shape stored as array of size labels
    dogSizes: ["Petit", "Moyen"],
    acceptsSmall: false,
    acceptsMedium: false,
    acceptsLarge: false,
  };
  const { checks } = computeSitterProfileCompletionDetails(profile);
  assert.equal(checks.dogSizes, true);
});

test("empty services (both shapes) flags services AND pricing as missing", () => {
  for (const services of [{}, [] as string[], null, undefined, "not-an-object"]) {
    const { checks, percent } = computeSitterProfileCompletionDetails({
      ...baseAddressEtc,
      services,
    });
    assert.equal(checks.services, false, `services=${JSON.stringify(services)} should fail services check`);
    assert.equal(checks.pricing, false, `services=${JSON.stringify(services)} should fail pricing too`);
    assert.ok(percent < 100, `services=${JSON.stringify(services)} should not be 100%`);
  }
});

test("Matilda's real data (audit 2026-05-22) — array shape used to give wrong %, now correct", () => {
  // Snapshot of dev DB row that surfaced the bug.
  const matildaCronView = {
    avatarUrl: "/api/media/sitter-avatar/c2l0dGVy...",
    firstName: "Matilda",
    city: "Lutry",
    address: "Chemin d'Orzens 40, 1095 Lutry",
    bio: "Garde sérieuse.",
    services: ["Promenade", "Garde"], // ← array shape from the column
    pricing: { Promenade: 20, Garde: 26 },
    acceptsSmall: true,
    acceptsMedium: true,
    acceptsLarge: true,
    stripeAccountStatus: "ENABLED",
  };

  const { percent, checks } = computeSitterProfileCompletionDetails(matildaCronView);
  // Before the fix this returned percent=88 (pricing falsely failing).
  assert.equal(checks.pricing, true);
  assert.equal(percent, 100, "Matilda's profile is genuinely 100% — array shape must not fake a 88%");
});
