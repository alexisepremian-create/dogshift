import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { presignPutObject } from "@/lib/r2";
import { reportPhotoPrefix } from "@/lib/reportPhotoMedia";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user?.sitterId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true, sitterId: true } });
    if (!booking || booking.sitterId !== user.sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const body = (await req.json().catch(() => null)) as { contentType?: string; sizeBytes?: number } | null;
    const contentType = typeof body?.contentType === "string" ? body.contentType.trim() : "";
    if (!contentType || !ALLOWED_MIMES.has(contentType)) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
    }
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : null;
    if (sizeBytes && (sizeBytes <= 0 || sizeBytes > MAX_BYTES)) {
      return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    const key = `${reportPhotoPrefix(user.sitterId, id)}${uuidv4()}.${EXT[contentType]}`;
    const { url, expiresIn } = await presignPutObject({ key, contentType, expiresInSeconds: 120 });
    return NextResponse.json({ ok: true, key, uploadUrl: url, expiresIn, maxBytes: MAX_BYTES });
  } catch (err) {
    console.error("[POST /api/host/bookings/[id]/report/photos/presign]", err);
    reportApiError({ kind: "internal_error", route: "host.booking.report.photo.presign" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
