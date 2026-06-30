/**
 * Regression for the /search location filter (components/SearchResultsClient).
 *
 * A named-place search ("Lausanne") must keep the grand-Lausanne agglomeration
 * but drop clearly-other towns. The founder's calibration examples:
 *   IN : Ecublens, Penthaz, Renens, Morges
 *   OUT: Chexbres (Lavaux), Vevey (Riviera)
 * The radius (SEARCH_HUB_RADIUS_KM) must split Penthaz from Chexbres.
 *
 * Also guards the string wiring in SearchResultsClient that makes this apply:
 * reading the `q` param (native map) + using the radius for known hubs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  haversineKm,
  LOCATION_HUB_COORDS,
  SITTER_FALLBACK_COORDS,
  SEARCH_HUB_RADIUS_KM,
} from "../../lib/sitterMapGeo.ts";

const lausanne = LOCATION_HUB_COORDS.lausanne;

const distKm = (place: { lat: number; lng: number }) => haversineKm(lausanne, place);

test("Lausanne radius INCLUDES the grand-Lausanne agglomeration", () => {
  for (const name of ["ecublens", "penthaz", "crissier", "renens"] as const) {
    const d = distKm(SITTER_FALLBACK_COORDS[name]);
    assert.ok(
      d <= SEARCH_HUB_RADIUS_KM,
      `${name} (${d.toFixed(1)} km) must be within the ${SEARCH_HUB_RADIUS_KM} km Lausanne radius.`,
    );
  }
});

test("Lausanne radius EXCLUDES clearly-other towns (Chexbres, Vevey)", () => {
  const chexbres = distKm(SITTER_FALLBACK_COORDS.chexbres);
  const vevey = distKm(LOCATION_HUB_COORDS.vevey);
  assert.ok(chexbres > SEARCH_HUB_RADIUS_KM, `Chexbres (${chexbres.toFixed(1)} km) must be excluded.`);
  assert.ok(vevey > SEARCH_HUB_RADIUS_KM, `Vevey (${vevey.toFixed(1)} km) must be excluded.`);
});

test("the radius splits Penthaz (in) from Chexbres (out)", () => {
  const penthaz = distKm(SITTER_FALLBACK_COORDS.penthaz);
  const chexbres = distKm(SITTER_FALLBACK_COORDS.chexbres);
  assert.ok(penthaz < chexbres, "Penthaz must be closer than Chexbres for the split to be possible.");
  assert.ok(
    penthaz <= SEARCH_HUB_RADIUS_KM && chexbres > SEARCH_HUB_RADIUS_KM,
    `Radius ${SEARCH_HUB_RADIUS_KM} km must keep Penthaz (${penthaz.toFixed(1)}) and drop Chexbres (${chexbres.toFixed(1)}).`,
  );
});

test("SearchResultsClient wires the q param, the hub radius and a 2-col grid", () => {
  const src = readFileSync(join(process.cwd(), "components/SearchResultsClient.tsx"), "utf8");
  // Reads the native-map `q` param as a fallback for `location`.
  assert.match(
    src,
    /sp\.get\("location"\)\s*\?\?\s*sp\.get\("q"\)/,
    "Must read the `q` param (native map search) as a fallback for `location`.",
  );
  // Uses the agglomeration radius for known hubs.
  assert.match(src, /distanceKm <= SEARCH_HUB_RADIUS_KM/, "Named-hub searches must filter by SEARCH_HUB_RADIUS_KM.");
  // Cards are shown two-per-row on mobile.
  assert.match(src, /grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3/, "Result cards must be a 2-col grid on mobile.");
  // The applied filters stay visible after a search that carries a service.
  assert.match(src, /useState\(Boolean\(initialService\)\)/, "The filter panel must default open when a filter is already applied.");
});
