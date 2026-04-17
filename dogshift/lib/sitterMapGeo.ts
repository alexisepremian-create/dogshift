/**
 * Shared geolocation helpers for sitter maps: fallback coords when DB lat/lng
 * are missing, and location filter semantics aligned with /sitters search.
 */

export function normalizeLocationText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Approximate hub for "search near this place" on the map (km radius). */
export const LOCATION_HUB_RADIUS_KM = 34;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Known place → coordinates. Keys must be ASCII-normalized (see normalizeLocationText).
 * Used for distance-based map filter when the user types a major place name or NPA.
 */
export const LOCATION_HUB_COORDS: Record<string, { lat: number; lng: number }> = {
  geneve: { lat: 46.2044, lng: 6.1432 },
  lausanne: { lat: 46.5197, lng: 6.6323 },
  nyon: { lat: 46.3833, lng: 6.2396 },
  vevey: { lat: 46.4628, lng: 6.8431 },
  montreux: { lat: 46.4312, lng: 6.9107 },
  morges: { lat: 46.5084, lng: 6.4986 },
  renens: { lat: 46.538, lng: 6.5881 },
  yverdonlesbains: { lat: 46.7785, lng: 6.6411 },
  yverdon: { lat: 46.7785, lng: 6.6411 },
  neuchatel: { lat: 46.9929, lng: 6.9319 },
  fribourg: { lat: 46.8065, lng: 7.1611 },
  sion: { lat: 46.2276, lng: 7.3593 },
  martigny: { lat: 46.1024, lng: 7.0723 },
  bern: { lat: 46.948, lng: 7.4474 },
  berne: { lat: 46.948, lng: 7.4474 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  basel: { lat: 47.5596, lng: 7.5886 },
  bale: { lat: 47.5596, lng: 7.5886 },
  lugano: { lat: 46.0037, lng: 8.9511 },
  "1201": { lat: 46.2046, lng: 6.1432 },
  "1207": { lat: 46.2102, lng: 6.1589 },
  "1003": { lat: 46.5191, lng: 6.6323 },
  "1004": { lat: 46.522, lng: 6.633 },
  "1006": { lat: 46.5334, lng: 6.6645 },
  "1260": { lat: 46.3833, lng: 6.2396 },
  "1110": { lat: 46.538, lng: 6.5881 },
  "1800": { lat: 46.4628, lng: 6.8431 },
  "1820": { lat: 46.4312, lng: 6.9107 },
};

/**
 * Fallback coords when sitter profile has no lat/lng (same keys as hubs where possible).
 */
export const SITTER_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  ...LOCATION_HUB_COORDS,
};

export function resolveSitterFallbackCoords(city: string, postalCode: string): { lat: number; lng: number } | null {
  const pc = String(postalCode ?? "").trim();
  if (pc && SITTER_FALLBACK_COORDS[pc]) return SITTER_FALLBACK_COORDS[pc];
  const c = normalizeLocationText(String(city ?? ""));
  if (c && SITTER_FALLBACK_COORDS[c]) return SITTER_FALLBACK_COORDS[c];
  return null;
}

function hubForQuery(normalizedQuery: string): { lat: number; lng: number } | null {
  if (!normalizedQuery) return null;
  if (LOCATION_HUB_COORDS[normalizedQuery]) return LOCATION_HUB_COORDS[normalizedQuery];
  const compact = normalizedQuery.replace(/\s+/g, "");
  if (compact && LOCATION_HUB_COORDS[compact]) return LOCATION_HUB_COORDS[compact];
  return null;
}

/**
 * Map "Lieu" filter: if query matches a known hub, keep sitters within {@link LOCATION_HUB_RADIUS_KM}.
 * Otherwise same as search list: normalized city or postal starts with the query.
 */
export function matchesMapLocationFilter(
  locationQuery: string,
  city: string,
  postalCode: string,
  sitterLat: number,
  sitterLng: number,
): boolean {
  const q = normalizeLocationText(locationQuery);
  if (!q) return true;

  const hub = hubForQuery(q);
  if (hub) {
    return haversineKm(hub, { lat: sitterLat, lng: sitterLng }) <= LOCATION_HUB_RADIUS_KM;
  }

  const normalizedCity = normalizeLocationText(city);
  const normalizedPc = normalizeLocationText(String(postalCode ?? "").replace(/\s+/g, ""));
  return normalizedCity.startsWith(q) || normalizedPc.startsWith(q);
}
