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

test("NativeMapHome fiche: rating opens reviews, photo opens a lightbox", () => {
  const src = readFileSync(join(process.cwd(), "components/native/NativeMapHome.tsx"), "utf8");
  // Rating is a button that opens the reviews sheet.
  assert.match(src, /onClick=\{openReviews\}/, "The rating must be tappable to open reviews.");
  assert.match(src, /const openReviews = useCallback[\s\S]*?\/api\/sitters\/\$\{sitterId\}/, "openReviews must fetch the sitter's reviews.");
  assert.match(src, /\{reviewsOpen && \(/, "There must be a reviews sheet.");
  assert.match(src, /reviewsList\.map/, "The reviews sheet must render the fetched reviews.");
  // Photo is a button that opens a lightbox.
  assert.match(src, /onClick=\{\(\) => setPhotoOpen\(true\)\}/, "The fiche photo must be tappable.");
  assert.match(src, /\{photoOpen && detailSitter && \([\s\S]*?max-h-\[80vh\]/, "Tapping the photo must open a full-size lightbox.");
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
  assert.match(src, /<p className="mt-2 text-sm text-slate-600 line-clamp-2">\{sitter\.bio\}/, "The bio stays for the web page.");
  assert.doesNotMatch(src, /embedded[\s\S]{0,80}line-clamp-2">\{sitter\.bio\}/, "The embedded recap must NOT show the bio (date shown instead).");
  assert.match(src, /embedded\s*\n?\s*\? "inline-flex shrink-0 items-center justify-center rounded-full bg-\[#7c3aed\]/, "Embedded CTA must be purple.");
  assert.match(src, /summary\?\.quantityLabel \|\| selectedService \|\| "Service à définir"/, "The total label must show the selected service instead of 'Service à définir'.");
  // Embedded: date shown statically in the recap, the interactive Dates card is
  // hidden, no availability-lag subtitle, and the service radio is a purple check.
  assert.match(src, /embedded \? \(\s*<>[\s\S]*?dateStart \?[\s\S]*?formatDisplayDate\(dateStart\)/, "Embedded recap must show the chosen date statically.");
  assert.match(src, /\{embedded \? null : \(\s*<div[^>]*>\s*<p className="text-sm font-semibold text-slate-900">Dates<\/p>/, "The interactive Dates card must be hidden when embedded.");
  assert.match(src, /!embedded && effectiveSelectedDate && selectedDateStatusLoaded \?/, "The availability subtitle must be hidden when embedded (no load flash).");
  assert.match(src, /embedded \? \(\s*\/\/ Clean purple check[\s\S]*?<Check className="h-4 w-4" strokeWidth=\{3\}/, "The embedded service selector must use a purple check, not the blue radio.");
  // No "all services then filtered" flash: gate the rows behind a skeleton until
  // availability loads.
  assert.match(src, /embedded && !selectedDateStatusLoaded \?[\s\S]*?animate-pulse rounded-xl bg-slate-100/, "Embedded service list must show a skeleton until availability loads (no flash of all services).");
  // Recap: pin next to the city + the chosen service (purple, paw icon) under the date.
  assert.match(src, /embedded \? <MapPin className="h-3\.5 w-3\.5 shrink-0 text-slate-400" \/> : null/, "Embedded recap must show a pin next to the city.");
  assert.match(src, /\{selectedService \? \([\s\S]*?<PawPrint[\s\S]*?\{selectedService\}/, "Embedded recap must show the chosen service (purple, paw icon).");
  // The last-minute pill only shows once availability is loaded (with the service).
  assert.match(src, /\(!embedded \|\| selectedDateStatusLoaded\) && lastMinuteEnabled === true/, "The last-minute pill must appear with the service, not before.");
  // Compact pass: Service card dropped when embedded; hourly time+duration side by
  // side; amber "Sélectionne …" banners removed (greyed button conveys it); all
  // remaining cards use the compact p-4 padding.
  assert.match(src, /Embedded: the Service card is dropped[\s\S]{0,120}?\{embedded \? null : \(/, "The Service card must be dropped when embedded.");
  assert.match(src, /embedded \? "mt-3 grid grid-cols-2 gap-2" : "mt-4 grid gap-3 sm:grid-cols-2"/, "Hourly details must be 2 boxes side by side when embedded.");
  assert.match(src, /embedded \? null : dateStart && !startTime && !hasLeadTimeOnlyForToday \?/, "The amber 'sélectionne une heure' banner must be removed when embedded.");
  assert.match(src, /embedded \? "rounded-3xl border border-slate-200 bg-white p-4"/, "Embedded cards must use the compact p-4 padding.");
  // Time/duration pickers open as an iOS-style bottom sheet (no off-screen overflow).
  assert.match(src, /fixed inset-x-0 bottom-0 z-\[1101\] rounded-t-3xl/, "Time/duration pickers must open as a bottom sheet.");
  // Night hours (before 06:00) are dropped from the time slots.
  assert.match(src, /Number\(slot\.time\.slice\(0, 2\)\) >= 6/, "Night hours (00:00–05:30) must be filtered out.");
  // Lieu de garde options are side by side on mobile.
  assert.match(src, /embedded \? "mt-3 grid grid-cols-2 gap-2" : "mt-4 grid gap-2 sm:grid-cols-2"/, "Lieu de garde options must be side by side when embedded.");
  // The picker list stays compact (a few rows that scroll) — not a full-height sheet.
  const compactList = (src.match(/max-h-\[176px\] overflow-y-auto/g) ?? []).length;
  assert.ok(compactList >= 2, "Both picker lists must be compact (max-h-[176px], ~3 rows then scroll).");
  assert.doesNotMatch(src, /max-h-\[(46vh|264px)\]/, "The picker list must not fill a large part of the popup anymore.");
  // Both pickers use a frosted translucent sheet + single scrollable column with a
  // NON-purple (slate) selection highlight — no more 3-col grid, no purple fill.
  const frostedCount = (src.match(/bg-white\/80 p-4 shadow-\[0_-20px_60px_rgba\(2,6,23,0\.25\)\] backdrop-blur-2xl/g) ?? []).length;
  assert.ok(frostedCount >= 2, "Both the time AND duration sheets must use the frosted translucent background.");
  assert.doesNotMatch(src, /grid grid-cols-3 gap-1\.5/, "The duration picker must not use a 3-col grid anymore (single column).");
  const slateSelCount = (src.match(/selected\s*\n?\s*\?\s*"bg-slate-900\/5 text-slate-900"/g) ?? []).length;
  assert.ok(slateSelCount >= 2, "Both pickers must use a slate (non-purple) selection highlight.");
  // Address inputs get a purple focus ring when embedded.
  const purpleFocus = (src.match(/focus:border-\[#7c3aed\] focus:ring-4 focus:ring-\[#7c3aed\]\/15/g) ?? []).length;
  assert.ok(purpleFocus >= 3, "The 3 address inputs must use a purple focus ring when embedded.");
  // "Votre chien" card is compact when embedded: no verbose text, just a small
  // purple "Ajouter votre chien" button.
  assert.match(src, /\{embedded \? null : \(\s*<p className="mt-1 text-sm text-slate-500">Le sitter recevra la fiche/, "The verbose dog-card subtitle must be hidden when embedded.");
  assert.match(src, /rounded-full bg-\[#7c3aed\] px-4 py-2 text-sm font-semibold text-white active:scale-95"\s*>\s*Ajouter votre chien/, "Embedded empty dog state must be a small purple 'Ajouter votre chien' button.");
  // The redundant bottom Récap aside is removed when embedded (top recap covers it).
  assert.match(src, /\{embedded \? null : \(\s*<aside className="lg:sticky lg:top-8 lg:self-start">/, "The bottom Récap aside must be hidden when embedded.");
});
