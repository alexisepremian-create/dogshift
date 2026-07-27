// Pure helpers for the adoption feed: filter parsing, age ↔ birthDate maths,
// French age labels and distance sorting.
//
// Kept import-free (except the sibling geo module, which is also pure) so
// `node --test` can run it directly.

import { haversineKm, type LatLng } from "./geo.ts";

/** Shift a date by N whole months, clamping the day (31 Mar − 1 month = 28/29 Feb). */
export function monthsBefore(reference: Date, months: number): Date {
  const d = new Date(reference.getTime());
  const targetMonth = d.getUTCMonth() - months;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  const lastDayOfTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDayOfTarget));
  return d;
}

/** Whole months between two dates (floor). */
export function ageInMonths(birthDate: Date, now: Date): number {
  let months =
    (now.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - birthDate.getUTCMonth());
  if (now.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Translate an age filter into a `birthDate` range for Prisma.
 * Older dog ⇒ earlier birthDate, so the bounds swap.
 */
export function birthDateRangeForAge(
  now: Date,
  minAgeMonths?: number | null,
  maxAgeMonths?: number | null
): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (typeof minAgeMonths === "number") range.lte = monthsBefore(now, minAgeMonths);
  if (typeof maxAgeMonths === "number") range.gte = monthsBefore(now, maxAgeMonths);
  return range;
}

/** French age label shown on the card: "7 semaines", "5 mois", "3 ans". */
export function formatAgeFR(birthDate: Date, now: Date): string {
  const months = ageInMonths(birthDate, now);
  if (months < 1) {
    const weeks = Math.max(1, Math.floor((now.getTime() - birthDate.getTime()) / (7 * 24 * 3600 * 1000)));
    return weeks === 1 ? "1 semaine" : `${weeks} semaines`;
  }
  // Months up to 23: "18 mois" is how a Swiss owner talks about a young dog,
  // "1 an et demi" would need a second unit for no gain.
  if (months < 24) return months === 1 ? "1 mois" : `${months} mois`;
  return `${Math.floor(months / 12)} ans`;
}

/** Split a "VD,GE,ZH" query param, de-duplicated, invalid codes dropped. */
export function parseCodeList(raw: string | null | undefined, allowed?: readonly string[]): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const code = part.trim().toUpperCase();
    if (!code) continue;
    if (allowed && !allowed.includes(code)) continue;
    seen.add(code);
  }
  return [...seen];
}

export type SortMode = "RECENT" | "DISTANCE" | "YOUNGEST";

export type SortableListing = {
  id: string;
  publishedAt: Date | null;
  createdAt: Date;
  birthDate: Date;
  lat: number | null;
  lng: number | null;
};

export type RankedListing<T extends SortableListing> = T & { distanceKm: number | null };

/**
 * Attach a distance, drop anything outside `maxDistanceKm`, then sort.
 *
 * Distance sorting happens in memory because a listing's coordinates are
 * optional: SQL can't order by a distance we may not have. The caller fetches a
 * wide-but-bounded candidate pool (same trick as the old breeding deck) and
 * trims here. Listings without coordinates never win a distance sort but are
 * still returned — a dog with a missing geocode must not vanish from the feed.
 */
export function rankListings<T extends SortableListing>(
  listings: T[],
  options: { origin?: LatLng | null; maxDistanceKm?: number | null; sort?: SortMode; now?: Date } = {}
): RankedListing<T>[] {
  const { origin, maxDistanceKm, sort = "RECENT" } = options;

  const withDistance: RankedListing<T>[] = listings.map((l) => ({
    ...l,
    distanceKm:
      origin && typeof l.lat === "number" && typeof l.lng === "number"
        ? haversineKm(origin, { lat: l.lat, lng: l.lng })
        : null,
  }));

  const filtered =
    typeof maxDistanceKm === "number"
      ? withDistance.filter((l) => l.distanceKm === null || l.distanceKm <= maxDistanceKm)
      : withDistance;

  const publishedTime = (l: SortableListing) => (l.publishedAt ?? l.createdAt).getTime();

  const sorted = [...filtered];
  if (sort === "DISTANCE") {
    sorted.sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return publishedTime(b) - publishedTime(a);
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return publishedTime(b) - publishedTime(a);
    });
  } else if (sort === "YOUNGEST") {
    sorted.sort((a, b) => b.birthDate.getTime() - a.birthDate.getTime() || publishedTime(b) - publishedTime(a));
  } else {
    sorted.sort((a, b) => publishedTime(b) - publishedTime(a));
  }
  return sorted;
}
