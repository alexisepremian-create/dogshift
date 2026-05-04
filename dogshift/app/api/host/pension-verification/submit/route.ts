/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { runPensionVerificationAgent } from "@/lib/pensionVerificationAgent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    type SubmitBody = { photoKeys?: string[]; exifData?: Record<string, unknown>[] };
    const body = (await req.json().catch(() => null)) as null | SubmitBody;
    const photoKeys = Array.isArray(body?.photoKeys)
      ? body.photoKeys.filter((k) => typeof k === "string" && k.startsWith("pension-verification/"))
      : [];
    const exifData = Array.isArray(body?.exifData) ? body.exifData : [];

    if (photoKeys.length < 3) {
      return NextResponse.json({ ok: false, error: "MIN_3_PHOTOS_REQUIRED" }, { status: 400 });
    }
    if (photoKeys.length > 8) {
      return NextResponse.json({ ok: false, error: "MAX_8_PHOTOS" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: { id: true, sitterId: true, displayName: true, pensionVerifStatus: true, user: { select: { email: true } } },
    });
    if (!profile?.sitterId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    if (profile.pensionVerifStatus === "approved") {
      return NextResponse.json({ ok: false, error: "ALREADY_APPROVED" }, { status: 409 });
    }

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: "pending",
        pensionPhotoUrls: photoKeys,
        pensionPhotoSubmittedAt: new Date(),
        pensionAiScore: null,
        pensionAiVerdict: null,
        pensionAiReasoning: null,
        pensionAiReviewedAt: null,
      },
    });

    // Use waitUntil so Vercel keeps the function alive after response
    waitUntil(
      runPensionVerificationAgent({
        sitterId: profile.sitterId,
        sitterName: profile.displayName ?? "",
        sitterEmail: profile.user?.email ?? "",
        exifData,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][host][pension-verification][submit]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
