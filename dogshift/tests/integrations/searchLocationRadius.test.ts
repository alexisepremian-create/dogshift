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
});

test("NativeMapHome: the whole browse → fiche → booking flow lives in the popup", () => {
  const src = readFileSync(join(process.cwd(), "components/native/NativeMapHome.tsx"), "utf8");
  // The popup has detail (fiche) + booking views in addition to the search ones.
  assert.match(src, /"main"\s*\|\s*"filters"\s*\|\s*"results"\s*\|\s*"detail"\s*\|\s*"booking"/, "The popup must have 'detail' + 'booking' views.");
  // Tapping a result OR a map-sheet card opens the fiche in the popup (no full page).
  assert.match(src, /onClick=\{\(\) => openSitterDetail\(s\)\}/, "Result rows must open the in-popup fiche.");
  assert.match(src, /if \(sheetOpen\) \{\s*openSitterDetail\(s\)/, "Map-sheet cards must open the in-popup fiche (no /sitters nav).");
  assert.doesNotMatch(src, /href=\{`\/sitters\/\$\{s\.id\}`\}/, "The map sheet must NOT link to the full sitter page anymore.");
  // The map marker mini-popup card also opens the fiche in the popup.
  assert.match(src, /onClick=\{\(\) => openSitterDetail\(activeSitter\)\}/, "The marker mini-popup must open the in-popup fiche.");
  assert.doesNotMatch(src, /href=\{`\/sitters\/\$\{activeSitter\.id\}`\}/, "The marker card must NOT link to the full sitter page anymore.");
  // The tariff rows are clickable to pick the service.
  assert.match(src, /onClick=\{\(\) => \{ setBookingService\(svc\)/, "Tariff rows must select the booking service.");
  // Réserver opens the in-popup booking view; the calendar shows availability.
  assert.match(src, /onClick=\{\(\) => setSearchPanelView\("booking"\)\}[\s\S]*?Réserver/, "Réserver must open the in-popup booking view.");
  assert.match(src, /<InlineCalendar[\s\S]*?statusForIso=\{bookingStatusForIso\}/, "The booking view must show the availability calendar.");
  assert.match(src, /day-status\/multi\?from=/, "It must fetch real day-by-day availability.");
  // Continuer opens the reservation flow IN the app (overlay), no page nav.
  assert.match(src, /setReservationOpen\(true\)/, "Continuer must open the in-app reservation overlay.");
  assert.doesNotMatch(src, /router\.push\(`\/sitter\/\$\{encodeURIComponent\(detailSitter\.id\)\}\/reservation/, "It must NOT navigate to the standalone reservation page.");
  // The overlay renders the REAL reservation flow (reused, not reimplemented).
  assert.match(src, /<ReservationClient sitter=\{reservationDto\} embedded/, "The overlay must render the real ReservationClient (embedded).");
  assert.match(src, /import\("@\/app\/\(marketing\)\/sitter\/\[sitterId\]\/reservation\/reservation-client"\)/, "ReservationClient must be lazy-loaded.");
});

test("ReservationClient supports an embedded (in-popup) mode", () => {
  const src = readFileSync(join(process.cwd(), "app/(marketing)/sitter/[sitterId]/reservation/reservation-client.tsx"), "utf8");
  // Additive props so the exact same flow renders inside the native popup.
  assert.match(src, /embedded = false/, "It must accept an `embedded` prop.");
  assert.match(src, /initialParams\?: \{ service\?: string; date\?: string; start\?: string; end\?: string \}/, "It must accept seeded params (no URL in the popup).");
  // Embedded drops the full-page chrome (title + Retour à l'annonce).
  assert.match(src, /embedded \? null : \([\s\S]*?Retour à l/, "Embedded mode must hide the page chrome.");
  // Params fall back to initialParams when there's no URL.
  assert.match(src, /initialParams\?\.service \?\? searchParams\.get\("service"\)/, "It must read seeded params before the URL.");
  // Embedded polish: round photo, no bio in the recap, purple CTA, honest label.
  assert.match(src, /embedded \? "h-12 w-12 shrink-0 rounded-full/, "Embedded recap photo must be a circle.");
  assert.match(src, /embedded \? null : <p className="mt-2 text-sm text-slate-600 line-clamp-2">\{sitter\.bio\}/, "Embedded recap must drop the bio.");
  assert.match(src, /embedded\s*\n?\s*\? "inline-flex shrink-0 items-center justify-center rounded-full bg-\[#7c3aed\]/, "Embedded CTA must be purple.");
  assert.match(src, /summary\?\.quantityLabel \|\| selectedService \|\| "Service à définir"/, "The total label must show the selected service instead of 'Service à définir'.");
});
