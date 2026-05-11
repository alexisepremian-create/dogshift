import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";
import { presignPutObject } from "@/lib/r2";
import { sitterAvatarObjectPrefix } from "@/lib/sitterAvatarMedia";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    // currentUser() removed — use __authed.email / __authed.name
    const email = __authed?.email ?? "";
    if (!email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    if (!__authed?.id) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json().catch(() => null)) as null | {
      contentType?: string;
      sizeBytes?: number;
    };

    const contentType = typeof body?.contentType === "string" ? body.contentType.trim() : "";
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : null;

    if (!contentType) {
      return NextResponse.json({ ok: false, error: "INVALID_CONTENT_TYPE" }, { status: 400 });
    }

    if (!ALLOWED_MIMES.has(contentType)) {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
    }

    if (typeof sizeBytes === "number" && (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES)) {
      return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    const db = prisma as unknown as {
      sitterProfile: {
        findUnique: (args: unknown) => Promise<{ sitterId?: string | null } | null>;
      };
    };

    const sitterProfile = await db.sitterProfile.findUnique({
      where: { userId: __authed.id },
      select: { sitterId: true },
    });

    if (!sitterProfile?.sitterId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const sitterId = String(sitterProfile.sitterId).trim();
    const ext = extForMime(contentType);
    if (!ext) return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });

    const uuid = uuidv4();
    const key = `${sitterAvatarObjectPrefix(sitterId)}${uuid}.${ext}`;

    const { url, expiresIn } = await presignPutObject({
      key,
      contentType,
      expiresInSeconds: 120,
    });

    return NextResponse.json(
      {
        ok: true,
        key,
        uploadUrl: url,
        expiresIn,
        maxBytes: MAX_BYTES,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][profile][avatar][presign] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
