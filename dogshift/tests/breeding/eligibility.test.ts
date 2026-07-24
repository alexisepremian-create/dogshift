import test from "node:test";
import assert from "node:assert/strict";

import { canEnableMating, sizeBucketFromWeight, isBreedingAgeHint } from "../../lib/breeding/eligibility.ts";

test("canEnableMating requires a known sex", () => {
  assert.deepEqual(canEnableMating({ sex: null }), { ok: false, reason: "SEX_REQUIRED" });
  assert.deepEqual(canEnableMating({ sex: undefined }), { ok: false, reason: "SEX_REQUIRED" });
  assert.deepEqual(canEnableMating({ sex: "MALE" }), { ok: true });
  assert.deepEqual(canEnableMating({ sex: "FEMALE" }), { ok: true });
});

test("sizeBucketFromWeight matches the app's petit/moyen/grand thresholds", () => {
  assert.equal(sizeBucketFromWeight(null), null);
  assert.equal(sizeBucketFromWeight(0), null);
  assert.equal(sizeBucketFromWeight(9.9), "small");
  assert.equal(sizeBucketFromWeight(10), "medium");
  assert.equal(sizeBucketFromWeight(25), "medium");
  assert.equal(sizeBucketFromWeight(25.1), "large");
});

test("isBreedingAgeHint is a soft, non-blocking hint", () => {
  const now = new Date("2026-07-24T12:00:00Z");
  assert.equal(isBreedingAgeHint(null, now), true, "unknown age → no warning");
  assert.equal(isBreedingAgeHint(2026, now), false, "born this year → too young");
  assert.equal(isBreedingAgeHint(2024, now), true, "~2y → of age");
  assert.equal(isBreedingAgeHint(2010, now), false, "~16y → too old");
});
