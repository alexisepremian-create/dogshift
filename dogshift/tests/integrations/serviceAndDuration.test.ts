/**
 * Regression: service label↔enum mapping and duration parsing for the search →
 * availability bridge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { serviceLabelToEnum, parseDurationToMin } from "../../lib/search/serviceAndDuration.ts";

test("FR labels map to Prisma enums", () => {
  assert.equal(serviceLabelToEnum("Promenade"), "PROMENADE");
  assert.equal(serviceLabelToEnum("Garde"), "DOGSITTING");
  assert.equal(serviceLabelToEnum("Pension"), "PENSION");
});

test("already-enum values pass through", () => {
  assert.equal(serviceLabelToEnum("DOGSITTING"), "DOGSITTING");
});

test("unknown / empty service → null", () => {
  assert.equal(serviceLabelToEnum(""), null);
  assert.equal(serviceLabelToEnum("Walk"), null);
  assert.equal(serviceLabelToEnum(null), null);
});

test("duration parsing", () => {
  assert.equal(parseDurationToMin("1h"), 60);
  assert.equal(parseDurationToMin("2h"), 120);
  assert.equal(parseDurationToMin("2h30"), 150);
  assert.equal(parseDurationToMin("12h"), 720);
});

test("invalid duration → null", () => {
  assert.equal(parseDurationToMin(""), null);
  assert.equal(parseDurationToMin("abc"), null);
  assert.equal(parseDurationToMin(null), null);
});
