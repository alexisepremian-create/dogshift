import test from "node:test";
import assert from "node:assert/strict";

import { canonicalPair, isMutualMatch } from "../../lib/breeding/matchDetection.ts";

test("canonicalPair is order-independent (same row for A→B and B→A)", () => {
  const ab = canonicalPair("aaa", "bbb");
  const ba = canonicalPair("bbb", "aaa");
  assert.deepEqual(ab, { dogAId: "aaa", dogBId: "bbb" });
  assert.deepEqual(ba, { dogAId: "aaa", dogBId: "bbb" });
});

test("isMutualMatch only on LIKE + reverse LIKE", () => {
  assert.equal(isMutualMatch("LIKE", { direction: "LIKE" }), true);
  assert.equal(isMutualMatch("LIKE", { direction: "PASS" }), false);
  assert.equal(isMutualMatch("LIKE", null), false);
  assert.equal(isMutualMatch("LIKE", undefined), false);
  assert.equal(isMutualMatch("PASS", { direction: "LIKE" }), false);
});
