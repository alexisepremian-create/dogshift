// Pure GPS-track math for the walk-tracking module. `node --test` safe (no imports).

export type LatLng = [number, number]; // [lat, lng]

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in metres (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a polyline, in metres. Rounded to the nearest metre. */
export function routeDistanceMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return Math.round(total);
}

/**
 * Reduce a dense track to at most `maxPoints` while always keeping the first
 * and last fix, using a uniform stride. Cheap, deterministic, and good enough
 * for a route line rendered on a small map.
 */
export function downsampleRoute(points: LatLng[], maxPoints: number): LatLng[] {
  if (maxPoints < 2 || points.length <= maxPoints) return points.slice();
  const stride = (points.length - 1) / (maxPoints - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(points[Math.round(i * stride)]);
  }
  // Guard against rounding collisions producing a shorter array or dupes at the tail.
  out[out.length - 1] = points[points.length - 1];
  return out;
}

/**
 * Drop obviously-bad fixes: identical consecutive points and impossible jumps
 * (a single hop longer than `maxJumpMeters`, default 500 m — GPS spikes).
 */
export function cleanRoute(points: LatLng[], maxJumpMeters = 500): LatLng[] {
  const out: LatLng[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(p);
      continue;
    }
    const d = haversineMeters(prev, p);
    if (d === 0) continue;
    if (d > maxJumpMeters) continue;
    out.push(p);
  }
  return out;
}
