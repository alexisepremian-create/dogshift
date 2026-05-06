import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
// Cache map images aggressively — coordinates rarely change for a given booking
export const revalidate = 86400;

const ALLOWED_REFERER = "https://www.dogshift.ch/";

/**
 * Compute the great-circle distance (km) between two coordinates using Haversine.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Build a clean SVG fallback when MapTiler isn't available. Renders a
 * stylised trajectory card (gradient bg + two pins + curved dashed line +
 * distance pill) that always looks professional in emails.
 */
function buildFallbackSvg(width: number, height: number, distanceKm: number): string {
  const w = width;
  const h = height;
  const pinA = { x: w * 0.18, y: h * 0.62 };
  const pinB = { x: w * 0.82, y: h * 0.38 };
  const cp = { x: (pinA.x + pinB.x) / 2, y: Math.min(pinA.y, pinB.y) - h * 0.18 };
  const km = distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eef2ff"/>
      <stop offset="100%" stop-color="#ede9fe"/>
    </linearGradient>
    <radialGradient id="grid" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#c7d2fe" stop-opacity="0.4"/>
    </radialGradient>
    <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#1e1b4b" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#grid)"/>
  <g stroke="#c7d2fe" stroke-width="1" opacity="0.5">
    ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${(h / 8) * i}" x2="${w}" y2="${(h / 8) * i}" />`).join("")}
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${(w / 12) * i}" y1="0" x2="${(w / 12) * i}" y2="${h}" />`).join("")}
  </g>
  <path d="M ${pinA.x} ${pinA.y} Q ${cp.x} ${cp.y} ${pinB.x} ${pinB.y}"
        fill="none" stroke="#7c3aed" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="2 8"/>
  <g transform="translate(${pinA.x - 16},${pinA.y - 40})" filter="url(#pinShadow)">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#6366f1"/>
    <circle cx="16" cy="16" r="6" fill="#ffffff"/>
  </g>
  <g transform="translate(${pinB.x - 16},${pinB.y - 40})" filter="url(#pinShadow)">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#7c3aed"/>
    <circle cx="16" cy="16" r="6" fill="#ffffff"/>
  </g>
  <g transform="translate(${w / 2 - 60}, ${h - 56})">
    <rect x="0" y="0" width="120" height="40" rx="20" fill="#ffffff" filter="url(#pinShadow)"/>
    <text x="60" y="26" text-anchor="middle"
          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
          font-size="16" font-weight="700" fill="#4f46e5">${km} km</text>
  </g>
</svg>`;
}

async function renderFallbackPng(
  width: number,
  height: number,
  distanceKm: number,
): Promise<Buffer> {
  const svg = buildFallbackSvg(width, height, distanceKm);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Server-side proxy for the booking travel map.
 *
 *   Strategy: try MapTiler Static Maps with a proper Referer (locked to
 *   *.dogshift.ch). If that succeeds (paid plan), stream the real map.
 *   Otherwise fall back to a stylised SVG trajectory card that always
 *   looks professional and contains the actual distance.
 *
 *   Why we need a proxy at all: email clients (Gmail's image proxy,
 *   Apple Mail, Outlook) strip the Referer header, so a direct MapTiler
 *   URL embedded in an email is always rejected. By going through our
 *   own /api/email/map endpoint we control the upstream Referer.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minLngStr = searchParams.get("minLng");
  const minLatStr = searchParams.get("minLat");
  const maxLngStr = searchParams.get("maxLng");
  const maxLatStr = searchParams.get("maxLat");
  const width = Number(searchParams.get("w") ?? 560);
  const height = Number(searchParams.get("h") ?? 240);

  if (!minLngStr || !minLatStr || !maxLngStr || !maxLatStr) {
    return NextResponse.json({ error: "missing coords" }, { status: 400 });
  }

  const minLng = Number(minLngStr);
  const minLat = Number(minLatStr);
  const maxLng = Number(maxLngStr);
  const maxLat = Number(maxLatStr);
  const distanceKm = haversineKm(minLat, minLng, maxLat, maxLng);

  const cacheHeaders = {
    "content-type": "image/png",
    "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
  } as const;

  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    const url =
      `https://api.maptiler.com/maps/streets-v2/static/` +
      `${minLngStr},${minLatStr},${maxLngStr},${maxLatStr}/${width}x${height}.png?key=${key}`;

    try {
      const resp = await fetch(url, { headers: { Referer: ALLOWED_REFERER } });
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        return new NextResponse(buf, { headers: cacheHeaders });
      }
    } catch {
      // fall through to SVG fallback
    }
  }

  const png = await renderFallbackPng(width, height, distanceKm);
  return new NextResponse(new Uint8Array(png), { headers: cacheHeaders });
}
