/**
 * Generates a URL for an email-friendly static map showing both sitter and
 * owner locations.
 *
 * Routes the request through our own /api/email/map proxy so email clients
 * (which strip or rewrite the Referer header and break MapTiler's domain
 * restriction) can load the image successfully. See the proxy route for
 * details.
 */
export function buildTravelMapUrl(params: {
  sitterLat: number;
  sitterLng: number;
  ownerLat: number;
  ownerLng: number;
  width?: number;
  height?: number;
  /** Absolute base URL (defaults to https://www.dogshift.ch). */
  baseUrl?: string;
}): string {
  const { sitterLat, sitterLng, ownerLat, ownerLng, width = 560, height = 240 } = params;

  const latDelta = Math.abs(ownerLat - sitterLat);
  const lngDelta = Math.abs(ownerLng - sitterLng);
  const latPad = Math.max(latDelta * 0.35, 0.008);
  const lngPad = Math.max(lngDelta * 0.35, 0.008);

  const minLng = (Math.min(sitterLng, ownerLng) - lngPad).toFixed(6);
  const minLat = (Math.min(sitterLat, ownerLat) - latPad).toFixed(6);
  const maxLng = (Math.max(sitterLng, ownerLng) + lngPad).toFixed(6);
  const maxLat = (Math.max(sitterLat, ownerLat) + latPad).toFixed(6);

  const base = (params.baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");
  const qs = new URLSearchParams({
    minLng,
    minLat,
    maxLng,
    maxLat,
    sitterLat: sitterLat.toFixed(6),
    sitterLng: sitterLng.toFixed(6),
    ownerLat: ownerLat.toFixed(6),
    ownerLng: ownerLng.toFixed(6),
    w: String(width),
    h: String(height),
  });
  return `${base}/api/email/map?${qs.toString()}`;
}
