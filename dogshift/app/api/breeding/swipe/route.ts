import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { swipeSchema } from "@/lib/validators/breeding";
import { canonicalPair, isMutualMatch } from "@/lib/breeding/matchDetection";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

export const runtime = "nodejs";

/** POST { swiperDogId, targetDogId, direction } — record a swipe, detect a match. */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(swipeSchema, await req.json().catch(() => null), { route: "breeding.swipe.post" });
    if (!parsed.ok) return parsed.response;
    const { swiperDogId, targetDogId, direction } = parsed.data;

    if (swiperDogId === targetDogId) {
      return NextResponse.json({ ok: false, error: "CANNOT_SWIPE_SELF" }, { status: 400 });
    }

    const [swiper, target] = await Promise.all([
      prisma.matingProfile.findUnique({ where: { id: swiperDogId }, select: { id: true, userId: true, enabled: true } }),
      prisma.matingProfile.findUnique({ where: { id: targetDogId }, select: { id: true, userId: true, enabled: true } }),
    ]);
    if (!swiper || swiper.userId !== user.id || !swiper.enabled) {
      return NextResponse.json({ ok: false, error: "SWIPER_NOT_FOUND" }, { status: 404 });
    }
    if (!target || !target.enabled || target.userId === user.id) {
      return NextResponse.json({ ok: false, error: "TARGET_NOT_FOUND" }, { status: 404 });
    }

    // Idempotent — a repeated swipe just updates the direction.
    await prisma.swipe.upsert({
      where: { swiperDogId_targetDogId: { swiperDogId, targetDogId } },
      create: { swiperDogId, targetDogId, direction },
      update: { direction },
    });

    if (direction !== "LIKE") {
      return NextResponse.json({ ok: true, matched: false });
    }

    const reverse = await prisma.swipe.findUnique({
      where: { swiperDogId_targetDogId: { swiperDogId: targetDogId, targetDogId: swiperDogId } },
      select: { direction: true },
    });
    if (!isMutualMatch("LIKE", reverse)) {
      return NextResponse.json({ ok: true, matched: false });
    }

    // Mutual LIKE → create (or reuse) the canonical match + its chat thread.
    const pair = canonicalPair(swiperDogId, targetDogId);
    const match = await prisma.match.upsert({
      where: { dogAId_dogBId: pair },
      create: { ...pair, thread: { create: {} } },
      update: {},
      select: { id: true, thread: { select: { id: true } } },
    });
    if (!match.thread) {
      await prisma.matchThread.create({ data: { matchId: match.id } });
    }

    const matchedDog = await prisma.matingProfile.findUnique({
      where: { id: targetDogId },
      select: { id: true, dog: { select: { name: true, breed: true, photoUrl: true } } },
    });

    return NextResponse.json({
      ok: true,
      matched: true,
      matchId: match.id,
      matchedDog: matchedDog
        ? {
            matingProfileId: matchedDog.id,
            dogName: matchedDog.dog.name,
            breed: matchedDog.dog.breed,
            photoUrl: matchedDog.dog.photoUrl ? publicDogPhotoPath(matchedDog.dog.photoUrl) : null,
          }
        : null,
    });
  } catch (err) {
    console.error("[POST /api/breeding/swipe]", err);
    reportApiError({ kind: "internal_error", route: "breeding.swipe.post" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
