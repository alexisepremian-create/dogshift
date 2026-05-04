/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: {
        pensionVerifStatus: true,
        pensionPhotoUrls: true,
        pensionPhotoSubmittedAt: true,
        pensionAiScore: true,
        pensionAiVerdict: true,
        pensionAiReasoning: true,
        pensionAdminNotes: true,
      },
    });

    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      status: profile.pensionVerifStatus ?? "not_submitted",
      photoCount: Array.isArray(profile.pensionPhotoUrls) ? profile.pensionPhotoUrls.length : 0,
      submittedAt: profile.pensionPhotoSubmittedAt ?? null,
      aiScore: profile.pensionAiScore ?? null,
      aiVerdict: profile.pensionAiVerdict ?? null,
      aiReasoning: profile.pensionAiReasoning ?? null,
      adminNotes: profile.pensionAdminNotes ?? null,
    });
  } catch (err) {
    console.error("[api][host][pension-verification][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
