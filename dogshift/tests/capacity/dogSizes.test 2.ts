import test from "node:test";
import assert from "node:assert/strict";

import {
  DOG_SIZE_WEIGHTS,
  DOG_SIZE_KEYS,
  MAX_CAPACITY_PLACES,
  DEFAULT_CAPACITY_PLACES,
  slotsUsed,
  computeCapacityFromCounts,
  generateCapacityScenarios,
} from "../../lib/constants/dog-sizes.ts";

test("DOG_SIZE_WEIGHTS has correct structure", () => {
  assert.strictEqual(DOG_SIZE_WEIGHTS.small.weight, 1);
  assert.strictEqual(DOG_SIZE_WEIGHTS.medium.weight, 2);
  assert.strictEqual(DOG_SIZE_WEIGHTS.large.weight, 3);
  assert.strictEqual(DOG_SIZE_WEIGHTS.small.label, "Petit");
  assert.strictEqual(DOG_SIZE_WEIGHTS.medium.label, "Moyen");
  assert.strictEqual(DOG_SIZE_WEIGHTS.large.label, "Grand");
});

test("DOG_SIZE_KEYS is ordered small → medium → large", () => {
  assert.deepStrictEqual([...DOG_SIZE_KEYS], ["small", "medium", "large"]);
});

test("constants have expected defaults", () => {
  assert.strictEqual(MAX_CAPACITY_PLACES, 15);
  assert.strictEqual(DEFAULT_CAPACITY_PLACES, 3);
});

test("slotsUsed returns correct weights", () => {
  assert.strictEqual(slotsUsed("small"), 1);
  assert.strictEqual(slotsUsed("medium"), 2);
  assert.strictEqual(slotsUsed("large"), 3);
});

test("computeCapacityFromCounts — basic calculation", () => {
  assert.strictEqual(computeCapacityFromCounts({ small: 3, medium: 2, large: 1 }), 10);
  assert.strictEqual(computeCapacityFromCounts({ small: 6 }), 6);
  assert.strictEqual(computeCapacityFromCounts({ large: 2 }), 6);
  assert.strictEqual(computeCapacityFromCounts({}), 1);
});

test("computeCapacityFromCounts — clamps to [1, MAX]", () => {
  assert.strictEqual(computeCapacityFromCounts({ small: 0, medium: 0, large: 0 }), 1);
  assert.strictEqual(computeCapacityFromCounts({ large: 10 }), MAX_CAPACITY_PLACES);
  assert.strictEqual(computeCapacityFromCounts({ small: 20 }), MAX_CAPACITY_PLACES);
});

test("computeCapacityFromCounts — partial counts default to 0", () => {
  assert.strictEqual(computeCapacityFromCounts({ small: 2 }), 2);
  assert.strictEqual(computeCapacityFromCounts({ medium: 1, large: 1 }), 5);
});

test("generateCapacityScenarios — returns empty for no enabled sizes", () => {
  const result = generateCapacityScenarios(6, []);
  assert.strictEqual(result.length, 0);
});

test("generateCapacityScenarios — returns empty for 0 capacity", () => {
  const result = generateCapacityScenarios(0, ["small", "medium", "large"]);
  assert.strictEqual(result.length, 0);
});

test("generateCapacityScenarios — single size only shows that size", () => {
  const result = generateCapacityScenarios(4, ["small"]);
  assert.ok(result.length >= 1);
  for (const combo of result) {
    assert.strictEqual(combo.medium, 0);
    assert.strictEqual(combo.large, 0);
    assert.ok(combo.small > 0);
  }
});

test("generateCapacityScenarios — 6 places, all sizes", () => {
  const result = generateCapacityScenarios(6, ["small", "medium", "large"], 5);
  assert.ok(result.length >= 3, `Expected at least 3 scenarios, got ${result.length}`);

  // Should have a 6-small scenario
  const allSmall = result.find((c) => c.small === 6 && c.medium === 0 && c.large === 0);
  assert.ok(allSmall, "Should have 6 small dogs scenario");

  // Should have a 3-medium scenario
  const allMedium = result.find((c) => c.small === 0 && c.medium === 3 && c.large === 0);
  assert.ok(allMedium, "Should have 3 medium dogs scenario");

  // Should have a 2-large scenario
  const allLarge = result.find((c) => c.small === 0 && c.medium === 0 && c.large === 2);
  assert.ok(allLarge, "Should have 2 large dogs scenario");
});

test("generateCapacityScenarios — all combos respect capacity", () => {
  for (let cap = 1; cap <= 15; cap++) {
    const combos = generateCapacityScenarios(cap, ["small", "medium", "large"], 5);
    for (const combo of combos) {
      const used = combo.small * 1 + combo.medium * 2 + combo.large * 3;
      assert.ok(used <= cap, `Capacity ${cap}: combo uses ${used} places but max is ${cap}`);
      assert.ok(used > 0, "Each scenario should use at least 1 place");
    }
  }
});

test("generateCapacityScenarios — disabled size never appears", () => {
  const combos = generateCapacityScenarios(10, ["small", "medium"]);
  for (const combo of combos) {
    assert.strictEqual(combo.large, 0, "Large should never appear when disabled");
  }
});

test("generateCapacityScenarios — respects maxScenarios limit", () => {
  const combos = generateCapacityScenarios(15, ["small", "medium", "large"], 3);
  assert.ok(combos.length <= 3, `Expected at most 3 scenarios, got ${combos.length}`);
});

test("generateCapacityScenarios — no duplicate scenarios", () => {
  const combos = generateCapacityScenarios(12, ["small", "medium", "large"], 10);
  const keys = combos.map((c) => `${c.small},${c.medium},${c.large}`);
  const unique = new Set(keys);
  assert.strictEqual(keys.length, unique.size, "Should not contain duplicate scenarios");
});
