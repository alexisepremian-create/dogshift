import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
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
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const clerkUser = await currentUser();
    const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!email) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured?.id) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

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
      where: { userId: ensured.id },
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
