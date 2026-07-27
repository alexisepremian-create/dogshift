import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { deckQuerySchema } from "@/lib/validators/breeding";
import { buildDeckWhere, type DeckActiveDog } from "@/lib/breeding/deck";
import { haversineKm } from "@/lib/breeding/geo";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

export const runtime = "nodejs";

// Fetch a wider candidate pool than `limit` so distance sorting is meaningful,
// then trim. Pilot scale is small, so this stays cheap.
const CANDIDATE_POOL = 100;

/** GET ?swiperDogId=…&breedMode=&size=&radiusKm=&limit= — candidates to swipe. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const params = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = zodParse(deckQuerySchema, params, { route: "breeding.deck.get" });
    if (!parsed.ok) return parsed.response;
    const { swiperDogId, breedMode, size, radiusKm, limit } = parsed.data;

    const active = await prisma.matingProfile.findUnique({
      where: { id: swiperDogId },
      select: { id: true, userId: true, enabled: true, lat: true, lng: true, dog: { select: { sex: true, breed: true } } },
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
    const where = buildDeckWhere(activeDog, { breedMode, size }) as Prisma.MatingProfileWhereInput;

    const rows = await prisma.matingProfile.findMany({
      where,
      take: CANDIDATE_POOL,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        goal: true,
        bio: true,
        region: true,
        lat: true,
        lng: true,
        locationLabel: true,
        photos: true,
        dog: { select: { name: true, breed: true, birthYear: true, sex: true, photoUrl: true } },
      },
    });

    const origin = typeof active.lat === "number" && typeof active.lng === "number" ? { lat: active.lat, lng: active.lng } : null;

    let cards = rows.map((r) => {
      const distanceKm =
        origin && typeof r.lat === "number" && typeof r.lng === "number"
          ? haversineKm(origin, { lat: r.lat, lng: r.lng })
          : null;
      return {
        matingProfileId: r.id,
        dogName: r.dog.name,
        breed: r.dog.breed,
        birthYear: r.dog.birthYear,
        sex: r.dog.sex,
        region: r.region,
        locationLabel: r.locationLabel,
        distanceKm,
        bio: r.bio,
        goal: r.goal,
        photos: (r.photos ?? []).map((k) => publicDogPhotoPath(k)),
        photoUrl: (r.photos ?? [])[0] ? publicDogPhotoPath(r.photos[0]) : r.dog.photoUrl ? publicDogPhotoPath(r.dog.photoUrl) : null,
      };
    });

    // Radius filter (only when we can measure distance) + nearest-first sort.
    if (origin && typeof radiusKm === "number") {
      cards = cards.filter((c) => c.distanceKm != null && c.distanceKm <= radiusKm);
    }
    cards.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    cards = cards.slice(0, limit);

    return NextResponse.json({ ok: true, cards, exhausted: cards.length === 0 });
  } catch (err) {
    console.error("[GET /api/breeding/deck]", err);
    reportApiError({ kind: "internal_error", route: "breeding.deck.get" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
