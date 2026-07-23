import { test } from "node:test";
import assert from "node:assert/strict";

import { computeCoverage } from "../../lib/availability/coverage.ts";

// A brand-new sitter's agenda is empty → every day is UNAVAILABLE → the profile
// is invisible in search. computeCoverage decides whether a sitter has a
// bookable rule for EVERY enabled service (the publish gate).

test("all enabled services have availability → ok", () => {
  const c = computeCoverage(["PROMENADE", "DOGSITTING"], ["PROMENADE", "DOGSITTING"]);
  assert.equal(c.ok, true);
  assert.deepEqual(c.missing, []);
});

test("one enabled service without availability → not ok, listed as missing", () => {
  const c = computeCoverage(["PROMENADE", "PENSION"], ["PROMENADE"]);
  assert.equal(c.ok, false);
  assert.deepEqual(c.missing, ["PENSION"]);
  assert.deepEqual(c.servicesWithAvailability, ["PROMENADE"]);
});

test("no enabled services at all → not ok (nothing to publish)", () => {
  const c = computeCoverage([], ["PROMENADE"]);
  assert.equal(c.ok, false);
});

test("extra availability for a non-enabled service does not count", () => {
  const c = computeCoverage(["PENSION"], ["PROMENADE", "DOGSITTING"]);
  assert.equal(c.ok, false);
  assert.deepEqual(c.missing, ["PENSION"]);
});

test("duplicate enabled entries are de-duplicated", () => {
  const c = computeCoverage(["PROMENADE", "PROMENADE"], ["PROMENADE"]);
  assert.equal(c.ok, true);
  assert.deepEqual(c.missing, []);
});
