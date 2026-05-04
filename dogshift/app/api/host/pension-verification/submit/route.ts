/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as null | { photoKeys?: string[] };
    const photoKeys = Array.isArray(body?.photoKeys)
      ? body.photoKeys.filter((k) => typeof k === "string" && k.startsWith("pension-verification/"))
      : [];

    if (photoKeys.length < 3) {
      return NextResponse.json({ ok: false, error: "MIN_3_PHOTOS_REQUIRED" }, { status: 400 });
    }
    if (photoKeys.length > 8) {
      return NextResponse.json({ ok: false, error: "MAX_8_PHOTOS" }, { status: 400 });
    }

    const db = prisma as any;
    const profile = await db.sitterProfile.findUnique({
      where: { userId },
      select: { id: true, sitterId: true, pensionVerifStatus: true },
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

    // Trigger AI review asynchronously (fire & forget)
    fetch(`${BASE}/api/agents/pension-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sitterId: profile.sitterId }),
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api][host][pension-verification][submit]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
