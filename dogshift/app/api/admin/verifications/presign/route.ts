import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { presignGetObject } from "@/lib/r2";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest) {
  const expected = (process.env.HOST_ADMIN_CODE ?? "").trim();
  const supplied = req.headers.get("x-admin-code")?.trim() ?? "";
  if (!expected || !supplied || supplied !== expected) {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { userId } = await auth();

    const body = (await req.json().catch(() => null)) as null | { sitterId?: string; fileKey?: string };
    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    const fileKey = typeof body?.fileKey === "string" ? body.fileKey.trim() : "";

    if (!sitterId || !fileKey) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const expectedPrefix = `identity-verification/${sitterId}/`;
    if (!fileKey.startsWith(expectedPrefix)) {
      return NextResponse.json({ ok: false, error: "INVALID_KEY" }, { status: 400 });
    }

    const db = prisma as unknown as {
      sitterProfile: { findFirst: (args: unknown) => Promise<{ id: string; sitterId: string; verificationStatus?: string | null } | null> };
      verificationAccessLog: { create: (args: unknown) => Promise<unknown> };
    };

    const sitterProfile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: { id: true, sitterId: true, verificationStatus: true },
    });

    if (!sitterProfile?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const status = typeof sitterProfile.verificationStatus === "string" ? sitterProfile.verificationStatus : "not_verified";
    if (status !== "pending" && status !== "approved" && status !== "rejected") {
      return NextResponse.json({ ok: false, error: "NOT_AVAILABLE" }, { status: 409 });
    }

    const { url, expiresIn } = await presignGetObject({ key: fileKey, expiresInSeconds: 60 });

    await db.verificationAccessLog.create({
      data: {
        sitterProfileId: sitterProfile.id,
        sitterId: sitterProfile.sitterId,
        action: "presign_get",
        fileKey,
        adminClerkUserId: userId ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
      },
    });

    return NextResponse.json({ ok: true, url, expiresIn }, { status: 200 });
  } catch (err) {
    console.error("[api][admin][verifications][presign] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
