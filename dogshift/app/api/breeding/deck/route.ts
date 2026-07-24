import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { deckQuerySchema } from "@/lib/validators/breeding";
import { buildDeckWhere, type DeckActiveDog } from "@/lib/breeding/deck";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

export const runtime = "nodejs";

/** GET ?swiperDogId=…&breedMode=&size=&region=&limit= — candidates to swipe. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const params = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = zodParse(deckQuerySchema, params, { route: "breeding.deck.get" });
    if (!parsed.ok) return parsed.response;
    const { swiperDogId, breedMode, size, region, limit } = parsed.data;

    const active = await prisma.matingProfile.findUnique({
      where: { id: swiperDogId },
      select: { id: true, userId: true, enabled: true, dog: { select: { sex: true, breed: true } } },
    });
    if (!active || active.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "PROFILE_NOT_FOUND" }, { status: 404 });
    }
    if (!active.enabled || !active.dog.sex) {
      // Not opted-in or sex unknown → nothing to show.
      return NextResponse.json({ ok: true, cards: [], exhausted: true });
    }

    const activeDog: DeckActiveDog = {
      id: active.id,
      userId: active.userId,
      sex: active.dog.sex,
      breed: active.dog.breed,
    };
    const where = buildDeckWhere(activeDog, { breedMode, size, region }) as Prisma.MatingProfileWhereInput;

    const rows = await prisma.matingProfile.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        goal: true,
        bio: true,
        region: true,
        dog: { select: { name: true, breed: true, birthYear: true, sex: true, photoUrl: true } },
      },
    });

    const cards = rows.map((r) => ({
      matingProfileId: r.id,
      dogName: r.dog.name,
      breed: r.dog.breed,
      birthYear: r.dog.birthYear,
      sex: r.dog.sex,
      region: r.region,
      bio: r.bio,
      goal: r.goal,
      photoUrl: r.dog.photoUrl ? publicDogPhotoPath(r.dog.photoUrl) : null,
    }));

    return NextResponse.json({ ok: true, cards, exhausted: cards.length === 0 });
  } catch (err) {
    console.error("[GET /api/breeding/deck]", err);
    reportApiError({ kind: "internal_error", route: "breeding.deck.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
