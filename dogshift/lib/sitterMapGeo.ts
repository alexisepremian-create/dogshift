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

/** Radius used for GPS "À proximité" searches — tight, same commune / city area. */
export const PROXIMITY_RADIUS_KM = 10;

/**
 * Radius for a NAMED-place search ("Lausanne") on the /search results list.
 *
 * Tuned from the founder's real examples so the "grand Lausanne" agglomeration
 * is INCLUDED but neighbouring towns that are clearly elsewhere are EXCLUDED:
 *   - Ecublens ~5 km, Morges ~10 km, Penthaz ~11.2 km  → IN  (agglomeration)
 *   - Chexbres ~12.0 km (Lavaux), Vevey ~17.3 km (Riviera) → OUT
 * 11.5 km is the value that splits Penthaz (in) from Chexbres (out). It is
 * deliberately tighter than LOCATION_HUB_RADIUS_KM (the wide map radius).
 */
export const SEARCH_HUB_RADIUS_KM = 11.5;

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
  // Romandie communes & NPAs (when DB lat/lng missing)
  crissier: { lat: 46.5521, lng: 6.5728 },
  ecublens: { lat: 46.5286, lng: 6.5626 },
  lutry: { lat: 46.5029, lng: 6.6858 },
  chexbres: { lat: 46.4811, lng: 6.7781 },
  territet: { lat: 46.4167, lng: 6.9167 },
  clarens: { lat: 46.4394, lng: 6.9094 },
  pully: { lat: 46.5108, lng: 6.6608 },
  prilly: { lat: 46.5386, lng: 6.6056 },
  denges: { lat: 46.5175, lng: 6.5444 },
  saintlegierlaville: { lat: 46.4736, lng: 6.7722 },
  corsiersurvevey: { lat: 46.4667, lng: 6.85 },
  chardonne: { lat: 46.4833, lng: 6.8167 },
  penthaz: { lat: 46.5976, lng: 6.5402 },
  "1303": { lat: 46.5976, lng: 6.5402 },
  "1020": { lat: 46.538, lng: 6.5881 },
  "1023": { lat: 46.5521, lng: 6.5728 },
  "1024": { lat: 46.5286, lng: 6.5626 },
  "1025": { lat: 46.5667, lng: 6.55 },
  "1026": { lat: 46.5208, lng: 6.5361 },
  "1027": { lat: 46.5175, lng: 6.5119 },
  "1028": { lat: 46.5167, lng: 6.4833 },
  "1029": { lat: 46.5667, lng: 6.5167 },
  "1071": { lat: 46.4811, lng: 6.7781 },
  "1090": { lat: 46.5, lng: 6.7167 },
  "1095": { lat: 46.5029, lng: 6.6858 },
  "1801": { lat: 46.45, lng: 6.85 },
  "1802": { lat: 46.4667, lng: 6.8333 },
  "1803": { lat: 46.4833, lng: 6.8167 },
  "1804": { lat: 46.4667, lng: 6.85 },
  "1805": { lat: 46.4833, lng: 6.7833 },
  "1806": { lat: 46.4667, lng: 6.7833 },
  "1807": { lat: 46.4667, lng: 6.9 },
  "1808": { lat: 46.45, lng: 6.8833 },
  "1809": { lat: 46.45, lng: 6.8667 },
  "1814": { lat: 46.4167, lng: 6.9167 },
  "1815": { lat: 46.4394, lng: 6.9094 },
  "1816": { lat: 46.4333, lng: 6.9167 },
  "1817": { lat: 46.4333, lng: 6.9 },
  "1818": { lat: 46.4312, lng: 6.9107 },
};

/** Switzerland rough center (matches marketing map default view). */
const CH_MAP_CENTER = { lat: 46.8182, lng: 8.2275 };
const PLACEHOLDER_SPREAD_LAT = 0.55;
const PLACEHOLDER_SPREAD_LNG = 0.85;

function fnv1a32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Last-resort stable coordinates so every published sitter can be shown on the map
 * when DB geocoding and city/NPA fallbacks are missing (e.g. new commune, typo).
 */
export function placeholderCoordsForSitterId(sitterId: string): { lat: number; lng: number } {
  const h = fnv1a32(sitterId);
  const u1 = (h & 0xffff) / 65535;
  const u2 = ((h >>> 16) & 0xffff) / 65535;
  return {
    lat: CH_MAP_CENTER.lat + (u1 - 0.5) * 2 * PLACEHOLDER_SPREAD_LAT,
    lng: CH_MAP_CENTER.lng + (u2 - 0.5) * 2 * PLACEHOLDER_SPREAD_LNG,
  };
}

/**
 * Resolves map coordinates for a published sitter: DB coords, then city/NPA table, then deterministic placeholder.
 */
export function resolveCoordsForPublishedSitterMap(
  sitterId: string,
  city: string,
  postalCode: string,
  dbLat: number | null | undefined,
  dbLng: number | null | undefined,
): { lat: number; lng: number } {
  const rawLat = typeof dbLat === "number" && Number.isFinite(dbLat) ? dbLat : null;
  const rawLng = typeof dbLng === "number" && Number.isFinite(dbLng) ? dbLng : null;
  if (rawLat != null && rawLng != null) {
    return { lat: rawLat, lng: rawLng };
  }
  const fromProfile = resolveSitterFallbackCoords(city, postalCode);
  if (fromProfile) return fromProfile;
  return placeholderCoordsForSitterId(sitterId);
}

export function resolveSitterFallbackCoords(city: string, postalCode: string): { lat: number; lng: number } | null {
  const pcRaw = String(postalCode ?? "").trim();
  const pc4 = pcRaw.match(/\b(\d{4})\b/)?.[1] ?? "";
  if (pc4 && SITTER_FALLBACK_COORDS[pc4]) return SITTER_FALLBACK_COORDS[pc4];
  if (pcRaw && SITTER_FALLBACK_COORDS[normalizeLocationText(pcRaw)]) {
    return SITTER_FALLBACK_COORDS[normalizeLocationText(pcRaw)];
  }
  const c = normalizeLocationText(String(city ?? ""));
  if (c && SITTER_FALLBACK_COORDS[c]) return SITTER_FALLBACK_COORDS[c];
  const first = c.split(/[\s,/]+/)[0];
  if (first && first !== c && SITTER_FALLBACK_COORDS[first]) return SITTER_FALLBACK_COORDS[first];
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
