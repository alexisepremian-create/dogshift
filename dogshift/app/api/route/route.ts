import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side proxy to OSRM — avoids browser CSP restrictions.
 * GET /api/route?fromLng=&fromLat=&toLng=&toLat=
 * Returns { coordinates: [[lng, lat], ...] } or { error }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const fromLng = searchParams.get("fromLng");
  const fromLat = searchParams.get("fromLat");
  const toLng   = searchParams.get("toLng");
  const toLat   = searchParams.get("toLat");

  if (!fromLng || !fromLat || !toLng || !toLat) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json({ error: "OSRM error" }, { status: 502 });

    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    const coordinates = data.routes?.[0]?.geometry?.coordinates ?? null;

    if (!coordinates) return NextResponse.json({ error: "No route" }, { status: 404 });

    return NextResponse.json({ coordinates });
  } catch {
    return NextResponse.json({ error: "Routing failed" }, { status: 502 });
  }
}
