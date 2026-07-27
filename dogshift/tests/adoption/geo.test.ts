import test from "node:test";
import assert from "node:assert/strict";

import { haversineKm, formatDistanceKm } from "../../lib/adoption/geo.ts";

test("haversineKm: known distance + symmetry + zero", () => {
  const lausanne = { lat: 46.5197, lng: 6.6323 };
  const geneva = { lat: 46.2044, lng: 6.1432 };
  const d = haversineKm(lausanne, geneva);
  assert.ok(d > 45 && d < 55, `Lausanne→Genève ~50km, got ${d}`);
  assert.equal(Math.round(haversineKm(lausanne, geneva)), Math.round(haversineKm(geneva, lausanne)));
  assert.equal(haversineKm(lausanne, lausanne), 0);
});

test("formatDistanceKm: rounding, sub-km, and unknown", () => {
  assert.equal(formatDistanceKm(4.6), "à 5 km");
  assert.equal(formatDistanceKm(0.4), "à moins d'1 km");
  assert.equal(formatDistanceKm(null), null);
  assert.equal(formatDistanceKm(undefined), null);
  assert.equal(formatDistanceKm(Number.NaN), null);
});
