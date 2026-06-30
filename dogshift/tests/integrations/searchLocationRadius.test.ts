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
});

test("SearchResultsClient: compact filters open a modal; cards are simplified", () => {
  const src = readFileSync(join(process.cwd(), "components/SearchResultsClient.tsx"), "utf8");
  // Filters live in a modal that opens from the Filtres button (not a tall
  // inline stack of selects) — the panel must default CLOSED.
  assert.match(src, /useState\(false\)/, "The mobile filter modal must default closed (compact header).");
  assert.match(src, /role="dialog"[\s\S]*?aria-modal="true"/, "Filtres must open a modal dialog.");
  assert.match(src, /<FilterPill /, "The modal must use chip selectors (FilterPill).");
  // Verified check moved to a corner badge on the avatar — no top-right ribbon
  // that clipped the name.
  assert.match(
    src,
    /-bottom-0\.5 -right-0\.5[\s\S]*?bg-emerald-500/,
    "The verified check must be a corner badge on the avatar (not a name-clipping ribbon).",
  );
  // Simplified card: the wordy bits are gone.
  assert.doesNotMatch(src, /Répond \{sitter\.responseTime\}/, "The card must drop the response-time line (less text).");
  assert.doesNotMatch(src, /line-clamp-3">\{sitter\.bio\}/, "The card must drop the bio paragraph (less text).");
  assert.doesNotMatch(src, /formatDogSizesLabeled\(sitter\.dogSizes\)/, "The card must drop the dog-sizes label (less text).");
  // The Contacter button is a small purple pill (not the full-width navy one).
  assert.match(
    src,
    /rounded-full bg-\[#7c3aed\] px-3 py-1\.5 text-xs[\s\S]*?>\s*Contacter/,
    "The /search Contacter button must be a small purple pill.",
  );
});

test("NativeMapHome shows the search results INSIDE the search popup (no /search nav)", () => {
  const src = readFileSync(join(process.cwd(), "components/native/NativeMapHome.tsx"), "utf8");
  // A third "results" view exists in the search panel.
  assert.match(src, /"main"\s*\|\s*"filters"\s*\|\s*"results"/, "The search panel must have a 'results' view.");
  // Submitting opens that view in-modal instead of navigating away.
  assert.match(
    src,
    /handleSearchSubmit = useCallback\(\(\) => \{\s*setSearchPanelView\("results"\)/,
    "Rechercher must switch to the in-modal results view.",
  );
  assert.doesNotMatch(src, /router\.push\(`\/sitters/, "It must NOT navigate to /sitters anymore (results are in the popup).");
  // Results reuse the agglomeration radius so the location filter matches /search.
  assert.match(src, /haversineKm\(hub[\s\S]*?SEARCH_HUB_RADIUS_KM/, "In-popup results must filter by the hub radius.");
  // Tapping a result opens the sitter fiche INSIDE the popup (detail view).
  assert.match(src, /"main"\s*\|\s*"filters"\s*\|\s*"results"\s*\|\s*"detail"/, "The popup must have a 'detail' (fiche) view.");
  assert.match(src, /setDetailSitter\(s\);\s*setSearchPanelView\("detail"\)/, "Tapping a result must open the in-popup fiche.");
  assert.match(src, /Services & tarifs/, "The fiche must show the services & prices.");
  // The fiche's Réserver CTA opens the full profile (where the booking calendar lives).
  assert.match(src, /href=\{`\/sitters\/\$\{detailSitter\.id\}`\}[\s\S]*?Réserver/, "The fiche CTA must open the sitter profile to book.");
});
