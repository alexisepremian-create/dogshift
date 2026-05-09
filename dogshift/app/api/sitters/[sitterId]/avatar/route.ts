/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generated types
 * lag behind the schema for SitterProfile in this codebase. */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Serves a sitter's avatar as a real HTTP image response.
 *
 * Why this endpoint exists:
 *   Six legacy sitter profiles have their avatar stored as a
 *   `data:image/...;base64,...` URL inside the database. Returning that
 *   directly to the client inlines several MB of base64 into the homepage
 *   HTML on every render (a 5 MB HTML payload was observed in production).
 *   That made the homepage feel like an "infinite loading" on mobile.
 *
 *   By rewriting `data:` avatars to `/api/sitters/{id}/avatar`, the HTML
 *   stays small, the browser fetches each avatar in parallel over HTTP/2,
 *   and the response is aggressively cacheable so subsequent visits cost
 *   only a 304.
 *
 *   For sitters that already have a normal CDN URL (R2, etc.), this
 *   endpoint redirects to it so the same URL pattern works everywhere.
 *
 * Route: GET /api/sitters/{sitterId}/avatar
 */

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9+.\-]+);base64,(.+)$/;

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "public, max-age=60" },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sitterId: string }> },
) {
  const { sitterId } = await ctx.params;
  const id = String(sitterId ?? "").trim();
  if (!id) return notFound();

  let profile: { avatarUrl: string | null; user: { image: string | null } | null } | null;
  try {
    profile = (await (prisma as any).sitterProfile.findUnique({
      where: { sitterId: id },
      select: {
        avatarUrl: true,
        user: { select: { image: true } },
      },
    })) as typeof profile;
  } catch {
    return notFound();
  }

  if (!profile) return notFound();

  const raw = (profile.avatarUrl ?? profile.user?.image ?? "").trim();
  if (!raw) return notFound();

  const dataMatch = raw.match(DATA_URL_RE);
  if (dataMatch) {
    const [, mime, base64] = dataMatch;
    let bytes: Buffer;
    try {
      bytes = Buffer.from(base64, "base64");
    } catch {
      return notFound();
    }
    if (bytes.length === 0) return notFound();

    const body = new Uint8Array(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(bytes.length),
        // Avatars rarely change once uploaded — cache aggressively at the CDN
        // and the browser. `stale-while-revalidate` keeps the UX snappy if the
        // sitter does swap their photo.
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return NextResponse.redirect(raw, {
      status: 302,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  return notFound();
}
