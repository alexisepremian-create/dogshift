import test from "node:test";
import assert from "node:assert/strict";

import { normalizeRanges } from "../../lib/availability/rangeValidation.ts";

test("normalizeRanges: accepts sorted non-overlapping ranges", () => {
  const res = normalizeRanges([
    { startMin: 60, endMin: 120 },
    { startMin: 180, endMin: 240 },
  ]);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.ranges, [
    { startMin: 60, endMin: 120 },
    { startMin: 180, endMin: 240 },
  ]);
});

test("normalizeRanges: rejects overlapping ranges", () => {
  const res = normalizeRanges([
    { startMin: 60, endMin: 200 },
    { startMin: 180, endMin: 240 },
  ]);
  assert.equal(res.ok, false);
});

test("normalizeRanges: rejects end<=start", () => {
  const res = normalizeRanges([{ startMin: 120, endMin: 120 }]);
  assert.equal(res.ok, false);
});
