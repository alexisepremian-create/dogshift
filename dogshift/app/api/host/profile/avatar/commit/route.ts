import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { headObject } from "@/lib/r2";
import { isSitterAvatarR2Key, publicAvatarMediaPath, sitterAvatarObjectPrefix } from "@/lib/sitterAvatarMedia";

export const runtime = "nodejs";

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

    const body = (await req.json().catch(() => null)) as null | { key?: string };
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    if (!key) {
      return NextResponse.json({ ok: false, error: "INVALID_KEY" }, { status: 400 });
    }

    const sitterProfile = await prisma.sitterProfile.findUnique({
      where: { userId: ensured.id },
      select: { id: true, sitterId: true },
    });

    if (!sitterProfile?.sitterId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const expectedPrefix = sitterAvatarObjectPrefix(String(sitterProfile.sitterId));
    if (!isSitterAvatarR2Key(key) || !key.startsWith(expectedPrefix)) {
      return NextResponse.json({ ok: false, error: "INVALID_KEY" }, { status: 400 });
    }

    try {
      await headObject({ key });
    } catch {
      return NextResponse.json({ ok: false, error: "OBJECT_NOT_FOUND" }, { status: 400 });
    }

    const mediaPath = publicAvatarMediaPath(key);
    if (!mediaPath) {
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }

    await prisma.sitterProfile.update({
      where: { userId: ensured.id },
      data: { avatarUrl: mediaPath },
      select: { id: true },
    });

    const userRow = await prisma.user.findUnique({
      where: { id: ensured.id },
      select: { hostProfileJson: true },
    });

    const rawJson = typeof userRow?.hostProfileJson === "string" ? userRow.hostProfileJson : null;
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson) as Record<string, unknown>;
        delete parsed.avatarDataUrl;
        parsed.avatarUrl = mediaPath;
        parsed.updatedAt = new Date().toISOString();
        await prisma.user.update({
          where: { id: ensured.id },
          data: { hostProfileJson: JSON.stringify(parsed) },
        });
      } catch {
        // ignore malformed json
      }
    }

    return NextResponse.json({ ok: true, avatarUrl: mediaPath, key }, { status: 200 });
  } catch (err) {
    console.error("[api][host][profile][avatar][commit] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
