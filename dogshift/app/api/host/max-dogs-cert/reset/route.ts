/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    void req;
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: { id: true, maxDogsCertVerifStatus: true },
    });
    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    if (profile.maxDogsCertVerifStatus === "approved") {
      return NextResponse.json({ ok: false, error: "ALREADY_APPROVED" }, { status: 409 });
    }

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        maxDogsCertVerifStatus: "not_submitted",
        maxDogsCertPhotoKey: null,
        maxDogsCertSubmittedAt: null,
        maxDogsCertReviewedAt: null,
        maxDogsCertAdminNotes: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][host][max-dogs-cert][reset]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
