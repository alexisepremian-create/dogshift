/**
 * Generates a URL for an email-friendly static map showing both sitter and
 * owner locations.
 *
 * Routes the request through our own /api/email/map proxy so email clients
 * (which strip or rewrite the Referer header and break MapTiler's domain
 * restriction) can load the image successfully. See the proxy route for
 * details.
 *
 * The default canvas size is rendered at 2× the display dimensions so the
 * resulting PNG stays crisp when the email client downsamples it to the
 * email body width (~516px). The bbox padding is computed with
 * Mercator-aware aspect-ratio matching so the route fills the canvas with
 * an even visual margin around the pins (instead of huge empty bands when
 * the route is mostly horizontal or mostly vertical).
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
  const { sitterLat, sitterLng, ownerLat, ownerLng, width = 1120, height = 480 } = params;

  const latDelta = Math.abs(ownerLat - sitterLat);
  const lngDelta = Math.abs(ownerLng - sitterLng);

  // Mercator scale factor at the bbox centre — longitude degrees are shorter
  // (in pixels) than latitude degrees as you move away from the equator.
  const cosLat = Math.cos(((sitterLat + ownerLat) / 2) * (Math.PI / 180));
  const targetAspect = width / height;
  const breathing = 0.18; // 18% margin around the pins

  // Start with proportional padding on both axes.
  let latPad = Math.max(latDelta * breathing, 0.004);
  let lngPad = Math.max(lngDelta * breathing, 0.004);

  // Adjust the *shorter* axis so the bbox aspect ratio matches the canvas.
  // Visual aspect of a lat/lng box at this latitude:
  //   visualAspect = (lngSpan * cosLat) / latSpan
  const visualAspect = (lngDelta * cosLat) / Math.max(latDelta, 0.0005);
  if (visualAspect >= targetAspect) {
    // bbox is wider than canvas → grow lat to fill height
    const targetLat = ((lngDelta + 2 * lngPad) * cosLat) / targetAspect;
    const requiredLatPad = (targetLat - latDelta) / 2;
    if (requiredLatPad > latPad) latPad = requiredLatPad;
  } else {
    // bbox is taller than canvas → grow lng to fill width
    const targetLng = ((latDelta + 2 * latPad) * targetAspect) / cosLat;
    const requiredLngPad = (targetLng - lngDelta) / 2;
    if (requiredLngPad > lngPad) lngPad = requiredLngPad;
  }

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
