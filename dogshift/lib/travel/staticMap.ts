/**
 * Generates a MapTiler Static Maps URL showing both sitter and owner locations.
 * Uses the bounding-box auto-fit endpoint so both points are always visible.
 */
export function buildTravelMapUrl(params: {
  sitterLat: number;
  sitterLng: number;
  ownerLat: number;
  ownerLng: number;
  width?: number;
  height?: number;
}): string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) return "";

  const { sitterLat, sitterLng, ownerLat, ownerLng, width = 560, height = 240 } = params;

  // Pad the bounding box so both markers are not at the edges
  const latDelta = Math.abs(ownerLat - sitterLat);
  const lngDelta = Math.abs(ownerLng - sitterLng);
  const latPad = Math.max(latDelta * 0.35, 0.008);
  const lngPad = Math.max(lngDelta * 0.35, 0.008);

  const minLng = (Math.min(sitterLng, ownerLng) - lngPad).toFixed(6);
  const minLat = (Math.min(sitterLat, ownerLat) - latPad).toFixed(6);
  const maxLng = (Math.max(sitterLng, ownerLng) + lngPad).toFixed(6);
  const maxLat = (Math.max(sitterLat, ownerLat) + latPad).toFixed(6);

  return (
    `https://api.maptiler.com/maps/streets-v2/static/` +
    `${minLng},${minLat},${maxLng},${maxLat}/${width}x${height}.png?key=${key}`
  );
}
