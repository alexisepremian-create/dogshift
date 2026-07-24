import test from "node:test";
import assert from "node:assert/strict";

import { buildRouteMapUrl } from "../../lib/serviceReport/routeStaticMap.ts";
import type { LatLng } from "../../lib/serviceReport/track.ts";

test("buildRouteMapUrl: null for empty/too-short routes", () => {
  assert.equal(buildRouteMapUrl({ route: [] }), null);
  assert.equal(buildRouteMapUrl({ route: [[47, 8]] }), null);
});

test("buildRouteMapUrl: encodes a path and honours baseUrl + size", () => {
  const route: LatLng[] = [[47.1, 8.1], [47.2, 8.2], [47.3, 8.3]];
  const url = buildRouteMapUrl({ route, baseUrl: "https://dev.example.com/", width: 600, height: 300 });
  assert.ok(url);
  const u = new URL(url!);
  assert.equal(u.origin, "https://dev.example.com");
  assert.equal(u.pathname, "/api/email/route-map");
  assert.equal(u.searchParams.get("w"), "600");
  assert.equal(u.searchParams.get("h"), "300");
  assert.equal(u.searchParams.get("path"), "47.10000,8.10000;47.20000,8.20000;47.30000,8.30000");
});

test("buildRouteMapUrl: caps encoded points for dense tracks", () => {
  const route: LatLng[] = Array.from({ length: 500 }, (_, i) => [47 + i * 0.0001, 8] as LatLng);
  const url = buildRouteMapUrl({ route, baseUrl: "https://x.test" });
  const path = new URL(url!).searchParams.get("path") ?? "";
  const count = path.split(";").length;
  assert.ok(count <= 64, `expected <=64 points, got ${count}`);
});
