import test from "node:test";
import assert from "node:assert/strict";

import { haversineMeters, routeDistanceMeters, downsampleRoute, cleanRoute, type LatLng } from "../../lib/serviceReport/track.ts";

test("haversineMeters: known distance (approx) and symmetry", () => {
  // Zurich HB → Zurich airport ≈ 8.9 km.
  const hb: LatLng = [47.3779, 8.5403];
  const airport: LatLng = [47.4515, 8.5646];
  const d = haversineMeters(hb, airport);
  assert.ok(d > 8000 && d < 9500, `expected ~8.9km, got ${d}`);
  assert.equal(Math.round(haversineMeters(hb, airport)), Math.round(haversineMeters(airport, hb)));
  assert.equal(haversineMeters(hb, hb), 0);
});

test("routeDistanceMeters: sums consecutive legs", () => {
  const pts: LatLng[] = [[47.0, 8.0], [47.0, 8.001], [47.0, 8.002]];
  const leg = haversineMeters(pts[0], pts[1]);
  assert.equal(routeDistanceMeters(pts), Math.round(leg * 2));
  assert.equal(routeDistanceMeters([[47, 8]]), 0, "single point = 0");
  assert.equal(routeDistanceMeters([]), 0, "empty = 0");
});

test("downsampleRoute: keeps endpoints and respects the cap", () => {
  const pts: LatLng[] = Array.from({ length: 100 }, (_, i) => [47 + i * 0.001, 8] as LatLng);
  const out = downsampleRoute(pts, 10);
  assert.equal(out.length, 10);
  assert.deepEqual(out[0], pts[0]);
  assert.deepEqual(out[out.length - 1], pts[pts.length - 1]);
  // Below the cap → unchanged (copy).
  const small: LatLng[] = [[47, 8], [47.1, 8]];
  assert.deepEqual(downsampleRoute(small, 10), small);
});

test("cleanRoute: drops dupes and impossible GPS jumps", () => {
  const pts: LatLng[] = [
    [47.0, 8.0],
    [47.0, 8.0], // dupe
    [47.0005, 8.0], // ~55m ok
    [48.0, 9.0], // huge jump → dropped
    [47.001, 8.0], // back on track
  ];
  const cleaned = cleanRoute(pts);
  assert.deepEqual(cleaned, [[47.0, 8.0], [47.0005, 8.0], [47.001, 8.0]]);
});
