/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { presignPutObject } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function extForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as null | { contentType?: string; sizeBytes?: number };
    const contentType = typeof body?.contentType === "string" ? body.contentType.trim() : "";

    if (!contentType || !ALLOWED_MIMES.has(contentType)) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
    }

    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : null;
    if (sizeBytes && (sizeBytes <= 0 || sizeBytes > MAX_BYTES)) {
      return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: { sitterId: true, maxDogsCertVerifStatus: true },
    });
    if (!profile?.sitterId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    if (profile.maxDogsCertVerifStatus === "approved") {
      return NextResponse.json({ ok: false, error: "ALREADY_APPROVED" }, { status: 409 });
    }

    const ext = extForMime(contentType);
    if (!ext) return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });

    const key = `max-dogs-cert/${profile.sitterId}/${uuidv4()}.${ext}`;
    const { url, expiresIn } = await presignPutObject({ key, contentType, expiresInSeconds: 120 });

    return NextResponse.json({ ok: true, key, uploadUrl: url, expiresIn, maxBytes: MAX_BYTES });
  } catch (err) {
    console.error("[api][host][max-dogs-cert][presign]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
