const EARTH_RADIUS_KM = 6371;

export const TRAVEL_RATE_CHF_PER_KM = 0.66;
export const MAX_TRAVEL_RADIUS_KM = 15;

/** Haversine great-circle distance in km between two lat/lng points. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export interface TravelFeeResult {
  ok: true;
  distanceKm: number;
  feeCents: number;
  feeChf: number;
}

export interface TravelFeeError {
  ok: false;
  reason: "OUT_OF_RANGE" | "MISSING_SITTER_ADDRESS" | "MISSING_OWNER_ADDRESS";
  distanceKm?: number;
}

export function computeTravelFee(
  sitterLat: number | null | undefined,
  sitterLng: number | null | undefined,
  ownerLat: number | null | undefined,
  ownerLng: number | null | undefined,
): TravelFeeResult | TravelFeeError {
  if (sitterLat == null || sitterLng == null) {
    return { ok: false, reason: "MISSING_SITTER_ADDRESS" };
  }
  if (ownerLat == null || ownerLng == null) {
    return { ok: false, reason: "MISSING_OWNER_ADDRESS" };
  }

  const distanceKm = haversineDistanceKm(sitterLat, sitterLng, ownerLat, ownerLng);

  if (distanceKm > MAX_TRAVEL_RADIUS_KM) {
    return { ok: false, reason: "OUT_OF_RANGE", distanceKm };
  }

  const feeChf = Math.round(distanceKm * TRAVEL_RATE_CHF_PER_KM * 100) / 100;
  const feeCents = Math.round(feeChf * 100);

  return { ok: true, distanceKm, feeCents, feeChf };
}
