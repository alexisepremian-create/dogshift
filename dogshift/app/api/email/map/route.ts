import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
// Cache aggressively — coordinates rarely change for a given booking
export const revalidate = 86400;

const ALLOWED_REFERER = "https://www.dogshift.ch/";
const TILE_SIZE = 256;
const MAX_ZOOM = 15;
const MIN_ZOOM = 6;

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

/** Mercator projection. Returns world-pixel coords at the given zoom level. */
function lngLatToWorldPx(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const n = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n;
  return { x, y };
}

/**
 * Pick the highest zoom level at which the bbox (with its padding) still
 * fits inside the requested `width × height` viewport.
 */
function pickZoom(
  minLng: number,
  minLat: number,
  maxLng: number,
  maxLat: number,
  width: number,
  height: number,
): number {
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const a = lngLatToWorldPx(minLng, maxLat, z);
    const b = lngLatToWorldPx(maxLng, minLat, z);
    if (b.x - a.x <= width && b.y - a.y <= height) return z;
  }
  return MIN_ZOOM;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Real-map renderer (free MapTiler tile API + sharp compositing)
 * ────────────────────────────────────────────────────────────────────────── */

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

async function renderRealMap(args: {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  sitterLat: number;
  sitterLng: number;
  ownerLat: number;
  ownerLng: number;
  width: number;
  height: number;
  key: string;
}): Promise<Buffer | null> {
  const { minLng, minLat, maxLng, maxLat, width, height, key } = args;

  const zoom = pickZoom(minLng, minLat, maxLng, maxLat, width, height);

  // Centre point in world pixels (Mercator) at this zoom level.
  const centreLng = (minLng + maxLng) / 2;
  const centreLat = (minLat + maxLat) / 2;
  const centre = lngLatToWorldPx(centreLng, centreLat, zoom);

  // Top-left of the canvas in world-pixel space.
  const originX = centre.x - width / 2;
  const originY = centre.y - height / 2;

  const tileMinX = Math.floor(originX / TILE_SIZE);
  const tileMinY = Math.floor(originY / TILE_SIZE);
  const tileMaxX = Math.ceil((originX + width) / TILE_SIZE);
  const tileMaxY = Math.ceil((originY + height) / TILE_SIZE);

  // We composite onto a tile-aligned canvas (offsets always >= 0, which is
  // a hard requirement of sharp.composite), then extract the desired window.
  const canvasWidth = (tileMaxX - tileMinX) * TILE_SIZE;
  const canvasHeight = (tileMaxY - tileMinY) * TILE_SIZE;

  const tilesNeeded: { x: number; y: number; px: number; py: number }[] = [];
  for (let ty = tileMinY; ty < tileMaxY; ty++) {
    for (let tx = tileMinX; tx < tileMaxX; tx++) {
      tilesNeeded.push({
        x: tx,
        y: ty,
        px: (tx - tileMinX) * TILE_SIZE,
        py: (ty - tileMinY) * TILE_SIZE,
      });
    }
  }

  const tileBuffers = await Promise.all(
    tilesNeeded.map(async (t) => {
      const buf = await fetchTile(zoom, t.x, t.y, key);
      if (!buf) return null;
      return { ...t, buf };
    }),
  );
  if (tileBuffers.some((t) => t === null)) return null;

  const composites = (tileBuffers as Array<NonNullable<(typeof tileBuffers)[number]>>).map((t) => ({
    input: t.buf,
    left: t.px,
    top: t.py,
  }));

  const fullMap = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 238, g: 242, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  // Crop to the requested window inside the tile-aligned canvas.
  const extractLeft = Math.max(0, Math.min(canvasWidth - width, Math.round(originX - tileMinX * TILE_SIZE)));
  const extractTop = Math.max(0, Math.min(canvasHeight - height, Math.round(originY - tileMinY * TILE_SIZE)));
  const baseMap = await sharp(fullMap)
    .extract({ left: extractLeft, top: extractTop, width, height })
    .png()
    .toBuffer();

  // Project the two pins back onto canvas coordinates so we can overlay them.
  // The extracted image's top-left corresponds to (tileMinX*TILE_SIZE + extractLeft,
  // tileMinY*TILE_SIZE + extractTop) in world-pixel space.
  const cropOriginX = tileMinX * TILE_SIZE + extractLeft;
  const cropOriginY = tileMinY * TILE_SIZE + extractTop;
  const sitterPx = lngLatToWorldPx(args.sitterLng, args.sitterLat, zoom);
  const ownerPx = lngLatToWorldPx(args.ownerLng, args.ownerLat, zoom);
  const ax = sitterPx.x - cropOriginX;
  const ay = sitterPx.y - cropOriginY;
  const bx = ownerPx.x - cropOriginX;
  const by = ownerPx.y - cropOriginY;
  const cx = (ax + bx) / 2;
  const cy = Math.min(ay, by) - Math.abs(bx - ax) * 0.18;

  // Pin sizes are tuned for a canvas that is rendered at retina-2x and
  // displayed at half the size in the email. Larger callers (4x scale)
  // automatically scale up because we drive everything off `width`.
  const scale = Math.max(1, Math.round(width / 560));
  const haloR = 14 * scale;
  const dotR = 9 * scale;
  const haloStroke = 12 * scale;
  const dashStroke = 5 * scale;
  const dashPattern = `${2 * scale} ${14 * scale}`;

  const overlaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="${2 * scale}" stdDeviation="${2 * scale}" flood-color="#1e1b4b" flood-opacity="0.30"/>
    </filter>
  </defs>
  <path d="M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}"
        fill="none" stroke="#ffffff" stroke-width="${haloStroke}" stroke-linecap="round" opacity="0.85"/>
  <path d="M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}"
        fill="none" stroke="#7c3aed" stroke-width="${dashStroke}" stroke-linecap="round" stroke-dasharray="${dashPattern}"/>
  <circle cx="${ax}" cy="${ay}" r="${haloR}" fill="#ffffff" filter="url(#pinShadow)"/>
  <circle cx="${ax}" cy="${ay}" r="${dotR}" fill="#6366f1"/>
  <circle cx="${bx}" cy="${by}" r="${haloR}" fill="#ffffff" filter="url(#pinShadow)"/>
  <circle cx="${bx}" cy="${by}" r="${dotR}" fill="#7c3aed"/>
</svg>`;

  return sharp(baseMap)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* ──────────────────────────────────────────────────────────────────────────
 * SVG fallback — used when MapTiler is unavailable / no key
 * ────────────────────────────────────────────────────────────────────────── */

function buildFallbackSvg(width: number, height: number): string {
  const w = width;
  const h = height;
  const pinA = { x: w * 0.20, y: h * 0.62 };
  const pinB = { x: w * 0.80, y: h * 0.38 };
  const cp = { x: (pinA.x + pinB.x) / 2, y: Math.min(pinA.y, pinB.y) - h * 0.18 };
  const scale = Math.max(1, Math.round(w / 560));
  const haloR = 14 * scale;
  const dotR = 9 * scale;
  const dashStroke = 5 * scale;
  const dashPattern = `${2 * scale} ${14 * scale}`;

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
      <feDropShadow dx="0" dy="${2 * scale}" stdDeviation="${2 * scale}" flood-color="#1e1b4b" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#grid)"/>
  <g stroke="#c7d2fe" stroke-width="1" opacity="0.5">
    ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${(h / 8) * i}" x2="${w}" y2="${(h / 8) * i}" />`).join("")}
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${(w / 12) * i}" y1="0" x2="${(w / 12) * i}" y2="${h}" />`).join("")}
  </g>
  <path d="M ${pinA.x} ${pinA.y} Q ${cp.x} ${cp.y} ${pinB.x} ${pinB.y}"
        fill="none" stroke="#7c3aed" stroke-width="${dashStroke}" stroke-linecap="round"
        stroke-dasharray="${dashPattern}"/>
  <circle cx="${pinA.x}" cy="${pinA.y}" r="${haloR}" fill="#ffffff" filter="url(#pinShadow)"/>
  <circle cx="${pinA.x}" cy="${pinA.y}" r="${dotR}" fill="#6366f1"/>
  <circle cx="${pinB.x}" cy="${pinB.y}" r="${haloR}" fill="#ffffff" filter="url(#pinShadow)"/>
  <circle cx="${pinB.x}" cy="${pinB.y}" r="${dotR}" fill="#7c3aed"/>
</svg>`;
}

async function renderFallbackPng(width: number, height: number): Promise<Buffer> {
  const svg = buildFallbackSvg(width, height);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/* ──────────────────────────────────────────────────────────────────────────
 * Route handler
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Server-side renderer for the booking travel map.
 *
 * Strategy:
 *   1. Try to fetch MapTiler raster tiles (free Tiles API) and composite
 *      them locally with sharp, then overlay two pins + a dashed route.
 *      This produces the exact same map as the booking page on the
 *      website but as a single PNG that any email client can render.
 *   2. If anything fails (no key, tile fetch error, network), fall back
 *      to a stylised SVG illustration so the email always shows something
 *      clean.
 *
 * Why we proxy at all: the MapTiler key is locked to *.dogshift.ch via
 * Referer; email clients (Gmail's image proxy, Apple Mail, Outlook) strip
 * the Referer header so a direct MapTiler URL embedded in an email is
 * rejected. By going through this endpoint we control the upstream
 * Referer from the server side.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const minLng = Number(searchParams.get("minLng"));
  const minLat = Number(searchParams.get("minLat"));
  const maxLng = Number(searchParams.get("maxLng"));
  const maxLat = Number(searchParams.get("maxLat"));
  const width = Number(searchParams.get("w") ?? 560);
  const height = Number(searchParams.get("h") ?? 240);
  const sitterLatStr = searchParams.get("sitterLat");
  const sitterLngStr = searchParams.get("sitterLng");
  const ownerLatStr = searchParams.get("ownerLat");
  const ownerLngStr = searchParams.get("ownerLng");

  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
    return NextResponse.json({ error: "missing or invalid coords" }, { status: 400 });
  }

  // Pin endpoints default to bbox corners when explicit pin coords aren't
  // provided (e.g. legacy callers).
  const sitterLat = sitterLatStr ? Number(sitterLatStr) : minLat;
  const sitterLng = sitterLngStr ? Number(sitterLngStr) : minLng;
  const ownerLat = ownerLatStr ? Number(ownerLatStr) : maxLat;
  const ownerLng = ownerLngStr ? Number(ownerLngStr) : maxLng;
  const cacheHeaders = {
    "content-type": "image/png",
    "cache-control": "public, max-age=86400, s-maxage=86400, immutable",
  } as const;

  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key) {
    try {
      const real = await renderRealMap({
        minLng,
        minLat,
        maxLng,
        maxLat,
        sitterLat,
        sitterLng,
        ownerLat,
        ownerLng,
        width,
        height,
        key,
      });
      if (real) {
        return new NextResponse(new Uint8Array(real), { headers: cacheHeaders });
      }
    } catch (err) {
      // Tile compositing failed — log + fall back to SVG so we never 500
      // (the email needs *something* to render).
      console.error("[/api/email/map] real-map render failed", err);
    }
  }

  try {
    const fallback = await renderFallbackPng(width, height);
    return new NextResponse(new Uint8Array(fallback), { headers: cacheHeaders });
  } catch (err) {
    console.error("[/api/email/map] fallback render failed", err);
    // Last-resort 1×1 transparent PNG so email clients don't show a broken
    // image icon. Hex bytes for an 8-bit RGBA 1×1 fully-transparent PNG.
    const blank = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=",
      "base64",
    );
    return new NextResponse(new Uint8Array(blank), { headers: cacheHeaders });
  }
}
