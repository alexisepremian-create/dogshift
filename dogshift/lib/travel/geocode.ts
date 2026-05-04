export interface GeocodedAddress {
  lat: number;
  lng: number;
  label: string;
}

/** Geocode a free-text address using MapTiler Geocoding API. */
export async function geocodeAddress(
  address: string,
): Promise<GeocodedAddress | null> {
  const apiKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!apiKey) return null;

  const q = encodeURIComponent(address.trim());
  const url = `https://api.maptiler.com/geocoding/${q}.json?key=${apiKey}&language=fr&country=ch&limit=1`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        place_name?: string;
      }>;
    };

    const feature = data.features?.[0];
    if (!feature?.geometry?.coordinates) return null;

    const [lng, lat] = feature.geometry.coordinates;
    const label = feature.place_name ?? address;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng, label };
  } catch {
    return null;
  }
}
