/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

/** Resets pension verification status back to not_submitted so sitter can resubmit. */
export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: { id: true, pensionVerifStatus: true },
    });

    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    // Only allow reset from non-approved/non-approved statuses
    if (profile.pensionVerifStatus === "approved") {
      return NextResponse.json({ ok: false, error: "ALREADY_APPROVED" }, { status: 409 });
    }

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: "not_submitted",
        pensionPhotoUrls: null,
        pensionPhotoSubmittedAt: null,
        pensionAiScore: null,
        pensionAiVerdict: null,
        pensionAiReasoning: null,
        pensionAiReviewedAt: null,
        pensionPhotoReviewedAt: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][host][pension-verification][reset]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
