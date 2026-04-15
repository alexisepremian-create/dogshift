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
