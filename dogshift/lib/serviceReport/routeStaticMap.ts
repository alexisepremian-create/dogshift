// Pure builder for the email/owner route-map image URL. `node --test` safe.
import { downsampleRoute, type LatLng } from "./track.ts";

/** Max points encoded in the image URL — keeps it well under URL length limits. */
const MAX_URL_POINTS = 64;

/**
 * Build the URL of the server-rendered route-map PNG for a recorded walk.
 * Coordinates are downsampled and encoded as `lat,lng;lat,lng` so the same URL
 * works in an owner-facing <img> and in the email (via the /api/email/route-map
 * proxy that controls the MapTiler Referer). Returns null for an empty route.
 */
export function buildRouteMapUrl(params: {
  route: LatLng[];
  width?: number;
  height?: number;
  baseUrl?: string;
}): string | null {
  const { route, width = 1120, height = 480 } = params;
  if (!Array.isArray(route) || route.length < 2) return null;

  const pts = downsampleRoute(route, MAX_URL_POINTS);
  const path = pts.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";");

  const base = (params.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
  const qs = new URLSearchParams({ w: String(width), h: String(height), path });
  return `${base}/api/email/route-map?${qs.toString()}`;
}
