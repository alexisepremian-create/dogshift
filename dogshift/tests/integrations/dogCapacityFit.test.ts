/**
 * Regression: the search capacity pre-filter must only keep sitters who accept
 * the requested sizes AND have enough total places (Petit=1, Moyen=2, Grand=3).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { dogCountsFitSitter, weightedDemand } from "../../lib/search/dogCapacityFit.ts";

const ALL = { acceptsSmall: true, acceptsMedium: true, acceptsLarge: true, capacityPlaces: 6 };

test("no dogs requested → no filter (true)", () => {
  assert.equal(dogCountsFitSitter({ petit: 0, moyen: 0, grand: 0 }, { capacityPlaces: 1 }), true);
});

test("weighted demand: 2 petit + 1 grand = 5", () => {
  assert.equal(weightedDemand({ petit: 2, moyen: 0, grand: 1 }), 5);
});

test("fits when capacity is enough", () => {
  assert.equal(dogCountsFitSitter({ petit: 2, moyen: 0, grand: 1 }, ALL), true); // 5 <= 6
});

test("rejected when total capacity too small", () => {
  assert.equal(
    dogCountsFitSitter({ petit: 2, moyen: 0, grand: 1 }, { ...ALL, capacityPlaces: 3 }),
    false, // 5 > 3
  );
});

test("rejected when a requested size is not accepted", () => {
  assert.equal(
    dogCountsFitSitter({ petit: 0, moyen: 0, grand: 1 }, { ...ALL, acceptsLarge: false }),
    false,
  );
});

test("size acceptance only matters for requested sizes", () => {
  // Requests only Petit; Grand not accepted is irrelevant.
  assert.equal(
    dogCountsFitSitter({ petit: 1, moyen: 0, grand: 0 }, { ...ALL, acceptsLarge: false }),
    true,
  );
});

test("null acceptance columns treated as accepted (DB default true)", () => {
  assert.equal(
    dogCountsFitSitter(
      { petit: 1, moyen: 1, grand: 0 },
      { acceptsSmall: null, acceptsMedium: null, acceptsLarge: null, capacityPlaces: 3 },
    ),
    true, // demand 3 <= 3
  );
});

test("null capacityPlaces falls back to default (3)", () => {
  assert.equal(
    dogCountsFitSitter({ petit: 1, moyen: 1, grand: 0 }, { ...ALL, capacityPlaces: null }),
    true, // demand 3 <= 3
  );
  assert.equal(
    dogCountsFitSitter({ petit: 0, moyen: 2, grand: 0 }, { ...ALL, capacityPlaces: null }),
    false, // demand 4 > 3
  );
});
