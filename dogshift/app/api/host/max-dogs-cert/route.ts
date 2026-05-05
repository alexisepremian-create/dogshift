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
        maxDogsCertVerifStatus: true,
        maxDogsCertPhotoKey: true,
        maxDogsCertSubmittedAt: true,
        maxDogsCertAdminNotes: true,
        acceptanceCriteria: true,
      },
    });

    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const maxDogs =
      profile.acceptanceCriteria &&
      typeof profile.acceptanceCriteria === "object" &&
      typeof (profile.acceptanceCriteria as Record<string, unknown>).maxDogs === "number"
        ? (profile.acceptanceCriteria as Record<string, unknown>).maxDogs as number
        : null;

    return NextResponse.json({
      ok: true,
      requiresCert: typeof maxDogs === "number" && maxDogs > 5,
      maxDogs,
      status: profile.maxDogsCertVerifStatus ?? "not_submitted",
      hasDocument: Boolean(profile.maxDogsCertPhotoKey),
      submittedAt: profile.maxDogsCertSubmittedAt ?? null,
      adminNotes: profile.maxDogsCertAdminNotes ?? null,
    });
  } catch (err) {
    console.error("[api][host][max-dogs-cert][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
