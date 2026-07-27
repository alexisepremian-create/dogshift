export async function geocodeSwissLocation({ city, postalCode }: { city: string; postalCode: string }) {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  const parts = [postalCode, city, "Switzerland"].map((v) => String(v ?? "").trim()).filter(Boolean);
  const query = parts.join(" ");
  if (!key || !query) return null;

  try {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(key)}&limit=1`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      features?: Array<{ center?: [number, number] }>;
    } | null;

    const center = data?.features?.[0]?.center;
    if (!Array.isArray(center) || center.length !== 2) return null;
    const [lng, lat] = center;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err) {
    console.error("[geocode] geocodeSwissLocation error", err);
    return null;
  }
}

/**
 * Reverse-geocode coordinates to a short human-readable place label
 * (municipality / locality), e.g. "Lausanne". Returns null on any failure.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${encodeURIComponent(key)}&language=fr&limit=1&types=municipality,locality,place`;
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      features?: Array<{ text?: string; place_name?: string }>;
    } | null;
    const f = data?.features?.[0];
    const label = (typeof f?.text === "string" && f.text.trim()) || (typeof f?.place_name === "string" && f.place_name.split(",")[0]?.trim()) || null;
    return label && label.length > 0 ? label.slice(0, 80) : null;
  } catch (err) {
    console.error("[geocode] reverseGeocode error", err);
    return null;
  }
}
