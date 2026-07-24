import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const revalidate = 86400;

// Server-rendered PNG of a recorded GPS walk (polyline overlay on MapTiler
// raster tiles). Sibling of /api/email/map — kept separate so the shared
// booking travel map stays untouched. Coordinates arrive as `path=lat,lng;…`.

const ALLOWED_REFERER = "https://www.dogshift.ch/";
const TILE_SIZE = 256;
const MAX_ZOOM = 16;
const MIN_ZOOM = 4;
const MAX_POINTS = 128;

type LatLng = [number, number];

function lngLatToWorldPx(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n;
  return { x, y };
}

function pickZoom(minLng: number, minLat: number, maxLng: number, maxLat: number, width: number, height: number): number {
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const a = lngLatToWorldPx(minLng, maxLat, z);
    const b = lngLatToWorldPx(maxLng, minLat, z);
    if (b.x - a.x <= width && b.y - a.y <= height) return z;
  }
  return MIN_ZOOM;
}

function parsePath(raw: string): LatLng[] {
  const out: LatLng[] = [];
  for (const pair of raw.split(";")) {
    const [latStr, lngStr] = pair.split(",");
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      out.push([lat, lng]);
    }
    if (out.length >= MAX_POINTS) break;
  }
  return out;
}

async function fetchTile(z: number, x: number, y: number, key: string): Promise<Buffer | null> {
  const n = 2 ** z;
  if (y < 0 || y >= n) return null;
  const wrappedX = ((x % n) + n) % n;
  const url = `https://api.maptiler.com/maps/streets-v2/${TILE_SIZE}/${z}/${wrappedX}/${y}.png?key=${key}`;
  try {
    const resp = await fetch(url, { headers: { Referer: ALLOWED_REFERER } });
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

function esc(v: number) {
  return Math.round(v * 100) / 100;
}

async function renderRouteMap(pts: LatLng[], width: number, height: number, key: string): Promise<Buffer | null> {
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  // 12% breathing room around the track.
  const latPad = Math.max((maxLat - minLat) * 0.12, 0.0015);
  const lngPad = Math.max((maxLng - minLng) * 0.12, 0.0015);
  minLat -= latPad; maxLat += latPad; minLng -= lngPad; maxLng += lngPad;

  const zoom = pickZoom(minLng, minLat, maxLng, maxLat, width, height);
  const centreLng = (minLng + maxLng) / 2;
  const centreLat = (minLat + maxLat) / 2;
  const centre = lngLatToWorldPx(centreLng, centreLat, zoom);
  const originX = centre.x - width / 2;
  const originY = centre.y - height / 2;

  const tileMinX = Math.floor(originX / TILE_SIZE);
  const tileMinY = Math.floor(originY / TILE_SIZE);
  const tileMaxX = Math.ceil((originX + width) / TILE_SIZE);
  const tileMaxY = Math.ceil((originY + height) / TILE_SIZE);
  const canvasWidth = (tileMaxX - tileMinX) * TILE_SIZE;
  const canvasHeight = (tileMaxY - tileMinY) * TILE_SIZE;

  const tilesNeeded: { x: number; y: number; px: number; py: number }[] = [];
  for (let ty = tileMinY; ty < tileMaxY; ty++) {
    for (let tx = tileMinX; tx < tileMaxX; tx++) {
      tilesNeeded.push({ x: tx, y: ty, px: (tx - tileMinX) * TILE_SIZE, py: (ty - tileMinY) * TILE_SIZE });
    }
  }
  const tileBuffers = await Promise.all(
    tilesNeeded.map(async (t) => {
      const buf = await fetchTile(zoom, t.x, t.y, key);
      return buf ? { ...t, buf } : null;
    }),
  );
  if (tileBuffers.some((t) => t === null)) return null;

  const composites = (tileBuffers as Array<NonNullable<(typeof tileBuffers)[number]>>).map((t) => ({
    input: t.buf,
    left: t.px,
    top: t.py,
  }));
  const fullMap = await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 238, g: 242, b: 255, alpha: 1 } },
  }).composite(composites).png().toBuffer();

  const extractLeft = Math.max(0, Math.min(canvasWidth - width, Math.round(originX - tileMinX * TILE_SIZE)));
  const extractTop = Math.max(0, Math.min(canvasHeight - height, Math.round(originY - tileMinY * TILE_SIZE)));
  const baseMap = await sharp(fullMap).extract({ left: extractLeft, top: extractTop, width, height }).png().toBuffer();

  const cropOriginX = tileMinX * TILE_SIZE + extractLeft;
  const cropOriginY = tileMinY * TILE_SIZE + extractTop;
  const canvasPts = pts.map(([lat, lng]) => {
    const p = lngLatToWorldPx(lng, lat, zoom);
    return { x: esc(p.x - cropOriginX), y: esc(p.y - cropOriginY) };
  });
  const d = canvasPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const scale = Math.max(1, Math.round(width / 560));
  const start = canvasPts[0];
  const end = canvasPts[canvasPts.length - 1];

  const overlaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <path d="${d}" fill="none" stroke="#ffffff" stroke-width="${9 * scale}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <path d="${d}" fill="none" stroke="#7c3aed" stroke-width="${5 * scale}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${start.x}" cy="${start.y}" r="${9 * scale}" fill="#ffffff"/>
  <circle cx="${start.x}" cy="${start.y}" r="${5 * scale}" fill="#22c55e"/>
  <circle cx="${end.x}" cy="${end.y}" r="${9 * scale}" fill="#ffffff"/>
  <circle cx="${end.x}" cy="${end.y}" r="${5 * scale}" fill="#7c3aed"/>
</svg>`;

  return sharp(baseMap)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function fallbackPng(width: number, height: number): Promise<Buffer> {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ede9fe"/>
  <path d="M ${width * 0.15} ${height * 0.7} Q ${width * 0.4} ${height * 0.2} ${width * 0.85} ${height * 0.5}"
        fill="none" stroke="#7c3aed" stroke-width="6" stroke-linecap="round" stroke-dasharray="4 14"/>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const width = Math.min(1600, Math.max(200, Number(searchParams.get("w") ?? 1120)));
  const height = Math.min(900, Math.max(120, Number(searchParams.get("h") ?? 480)));
  const pts = parsePath(searchParams.get("path") ?? "");
  const key = (process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "").trim();

  const headers = { "content-type": "image/png", "cache-control": "public, max-age=86400, immutable" };
  try {
    let png: Buffer | null = null;
    if (key && pts.length >= 2) png = await renderRouteMap(pts, width, height, key);
    if (!png) png = await fallbackPng(width, height);
    return new NextResponse(new Uint8Array(png), { status: 200, headers });
  } catch {
    const png = await fallbackPng(width, height);
    return new NextResponse(new Uint8Array(png), { status: 200, headers });
  }
}
