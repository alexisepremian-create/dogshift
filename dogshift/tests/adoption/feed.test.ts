import test from "node:test";
import assert from "node:assert/strict";

import {
  ageInMonths,
  birthDateRangeForAge,
  formatAgeFR,
  monthsBefore,
  parseCodeList,
  rankListings,
} from "../../lib/adoption/feed.ts";

const NOW = new Date("2026-07-27T12:00:00.000Z");

test("monthsBefore clamps the day instead of overflowing the month", () => {
  assert.equal(monthsBefore(new Date("2026-03-31T00:00:00Z"), 1).toISOString().slice(0, 10), "2026-02-28");
  assert.equal(monthsBefore(new Date("2024-03-31T00:00:00Z"), 1).toISOString().slice(0, 10), "2024-02-29");
  assert.equal(monthsBefore(new Date("2026-07-27T00:00:00Z"), 12).toISOString().slice(0, 10), "2025-07-27");
});

test("ageInMonths floors and never goes negative", () => {
  assert.equal(ageInMonths(new Date("2026-07-01T00:00:00Z"), NOW), 0);
  assert.equal(ageInMonths(new Date("2026-06-27T00:00:00Z"), NOW), 1);
  assert.equal(ageInMonths(new Date("2026-06-28T00:00:00Z"), NOW), 0, "one day short of a month");
  assert.equal(ageInMonths(new Date("2023-07-27T00:00:00Z"), NOW), 36);
  assert.equal(ageInMonths(new Date("2027-01-01T00:00:00Z"), NOW), 0, "future date clamps to 0");
});

test("birthDateRangeForAge inverts the bounds — older dog means earlier birthDate", () => {
  const range = birthDateRangeForAge(NOW, 12, 24);
  assert.equal(range.lte?.toISOString().slice(0, 10), "2025-07-27", "at least 12 months old");
  assert.equal(range.gte?.toISOString().slice(0, 10), "2024-07-27", "at most 24 months old");

  assert.deepEqual(birthDateRangeForAge(NOW, null, null), {});
  assert.equal(birthDateRangeForAge(NOW, 0, null).lte?.toISOString().slice(0, 10), "2026-07-27");
});

test("formatAgeFR switches unit at 1 month and 2 years", () => {
  assert.equal(formatAgeFR(new Date("2026-07-20T00:00:00Z"), NOW), "1 semaine");
  assert.equal(formatAgeFR(new Date("2026-07-06T00:00:00Z"), NOW), "3 semaines");
  assert.equal(formatAgeFR(new Date("2026-06-27T00:00:00Z"), NOW), "1 mois");
  assert.equal(formatAgeFR(new Date("2026-02-27T00:00:00Z"), NOW), "5 mois");
  assert.equal(formatAgeFR(new Date("2024-08-27T00:00:00Z"), NOW), "23 mois");
  assert.equal(formatAgeFR(new Date("2024-07-27T00:00:00Z"), NOW), "2 ans");
  // A one-year-old stays in months on purpose — that's how owners say it.
  assert.equal(formatAgeFR(new Date("2025-07-27T00:00:00Z"), NOW), "12 mois");
  assert.equal(formatAgeFR(new Date("2016-01-27T00:00:00Z"), NOW), "10 ans");
});

test("parseCodeList de-duplicates, upper-cases and can filter to an allow-list", () => {
  assert.deepEqual(parseCodeList("vd, GE ,vd"), ["VD", "GE"]);
  assert.deepEqual(parseCodeList(""), []);
  assert.deepEqual(parseCodeList(null), []);
  assert.deepEqual(parseCodeList("SMALL,HUGE", ["SMALL", "MEDIUM"]), ["SMALL"]);
});

function listing(id: string, over: Partial<Parameters<typeof rankListings>[0][number]> = {}) {
  return {
    id,
    publishedAt: new Date("2026-07-01T00:00:00Z"),
    createdAt: new Date("2026-07-01T00:00:00Z"),
    birthDate: new Date("2024-01-01T00:00:00Z"),
    lat: null as number | null,
    lng: null as number | null,
    ...over,
  };
}

const LAUSANNE = { lat: 46.5197, lng: 6.6323 };

test("rankListings sorts by distance but never drops a listing with no coordinates", () => {
  const ranked = rankListings(
    [
      listing("geneva", { lat: 46.2044, lng: 6.1432 }),
      listing("nocoords"),
      listing("lausanne", { lat: 46.52, lng: 6.63 }),
    ],
    { origin: LAUSANNE, sort: "DISTANCE" }
  );
  assert.deepEqual(
    ranked.map((l) => l.id),
    ["lausanne", "geneva", "nocoords"]
  );
  assert.equal(ranked[2].distanceKm, null);
  assert.ok((ranked[0].distanceKm ?? 99) < 1);
});

test("maxDistanceKm filters far listings but keeps the un-geocoded ones", () => {
  const ranked = rankListings(
    [listing("geneva", { lat: 46.2044, lng: 6.1432 }), listing("nocoords")],
    { origin: LAUSANNE, maxDistanceKm: 10, sort: "DISTANCE" }
  );
  assert.deepEqual(
    ranked.map((l) => l.id),
    ["nocoords"],
    "Genève is ~50 km away; a dog with a missing geocode must not vanish"
  );
});

test("RECENT falls back to createdAt when a listing has no publishedAt", () => {
  const ranked = rankListings([
    listing("old", { publishedAt: new Date("2026-01-01T00:00:00Z") }),
    listing("draftish", { publishedAt: null, createdAt: new Date("2026-07-26T00:00:00Z") }),
  ]);
  assert.deepEqual(
    ranked.map((l) => l.id),
    ["draftish", "old"]
  );
});

test("YOUNGEST sorts by birthDate descending", () => {
  const ranked = rankListings(
    [
      listing("senior", { birthDate: new Date("2016-01-01T00:00:00Z") }),
      listing("puppy", { birthDate: new Date("2026-05-01T00:00:00Z") }),
    ],
    { sort: "YOUNGEST" }
  );
  assert.deepEqual(
    ranked.map((l) => l.id),
    ["puppy", "senior"]
  );
});

test("rankListings does not mutate its input", () => {
  const input = [listing("a"), listing("b")];
  const copy = input.map((l) => l.id);
  rankListings(input, { sort: "YOUNGEST" });
  assert.deepEqual(
    input.map((l) => l.id),
    copy
  );
});
