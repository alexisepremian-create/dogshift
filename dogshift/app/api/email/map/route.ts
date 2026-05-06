import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Cache map images aggressively — coordinates rarely change for a given booking
export const revalidate = 86400;

const ALLOWED_REFERER = "https://www.dogshift.ch/";

/**
 * Server-side proxy for MapTiler static maps.
 *
 * Why we need this:
 *   The MapTiler API key is locked to *.dogshift.ch via HTTP Referer.
 *   Email clients (Gmail's image proxy, Apple Mail, Outlook) strip or
 *   replace the Referer header when they fetch the image, so MapTiler
 *   returns a 403 "Invalid key" placeholder.
 *
 *   This route fetches the static map server-side with the proper Referer
 *   header, then streams the PNG back to the email client. Because the
 *   request now originates from our own domain (a public URL on
 *   dogshift.ch/api/email/map), every email client can load it normally.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minLng = searchParams.get("minLng");
  const minLat = searchParams.get("minLat");
  const maxLng = searchParams.get("maxLng");
  const maxLat = searchParams.get("maxLat");
  const width = Number(searchParams.get("w") ?? 560);
  const height = Number(searchParams.get("h") ?? 240);

  if (!minLng || !minLat || !maxLng || !maxLat) {
    return NextResponse.json({ error: "missing coords" }, { status: 400 });
  }

  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) {
    return NextResponse.json({ error: "no maptiler key" }, { status: 500 });
  }

  const url =
    `https://api.maptiler.com/maps/streets-v2/static/` +
    `${minLng},${minLat},${maxLng},${maxLat}/${width}x${height}.png?key=${key}`;

  try {
    const resp = await fetch(url, { headers: { Referer: ALLOWED_REFERER } });
    if (!resp.ok) {
      return NextResponse.json({ error: `maptiler ${resp.status}` }, { status: 502 });
    }
    const buf = await resp.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}
