import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { listingCreateSchema, listingFeedQuerySchema } from "@/lib/validators/adoption";
import { birthDateRangeForAge, parseCodeList, rankListings } from "@/lib/adoption/feed";
import { serializeListingCard, type ListingCardRow } from "@/lib/adoption/serialize";

export const runtime = "nodejs";

/**
 * Fetch wide, rank in memory, trim. Distance sorting can't be expressed in SQL
 * here (coordinates are nullable), so we bound the pool instead of paging on a
 * key we don't have. 200 is comfortably above the whole Swiss inventory.
 */
const CANDIDATE_POOL = 200;
const DEFAULT_LIMIT = 20;

const CARD_SELECT = {
  id: true,
  dogName: true,
  breed: true,
  secondaryBreed: true,
  isCrossbreed: true,
  sex: true,
  birthDate: true,
  sizeCategory: true,
  canton: true,
  city: true,
  lat: true,
  lng: true,
  photos: true,
  feeAmount: true,
  goodWithChildren: true,
  goodWithDogs: true,
  goodWithCats: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  organization: { select: { id: true, name: true, status: true, logoUrl: true } },
} as const;

/** GET — the public adoption feed. Published listings only. */
export async function GET(req: NextRequest) {
  try {
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = zodParse(listingFeedQuerySchema, raw, { route: "adoption.listings.feed" });
    if (!parsed.ok) return parsed.response;
    const q = parsed.data;

    const now = new Date();
    const cantons = parseCodeList(q.cantons);
    const sizes = parseCodeList(q.sizes) as ("SMALL" | "MEDIUM" | "LARGE" | "GIANT")[];
    const birthDate = birthDateRangeForAge(now, q.minAgeMonths, q.maxAgeMonths);

    const where: Prisma.AdoptionListingWhereInput = {
      status: "PUBLISHED",
      ...(cantons.length > 0 ? { canton: { in: cantons } } : {}),
      ...(sizes.length > 0 ? { sizeCategory: { in: sizes } } : {}),
      ...(q.sex ? { sex: q.sex } : {}),
      ...(birthDate.gte || birthDate.lte ? { birthDate } : {}),
      ...(q.goodWithChildren ? { goodWithChildren: true } : {}),
      ...(q.goodWithDogs ? { goodWithDogs: true } : {}),
      ...(q.goodWithCats ? { goodWithCats: true } : {}),
      ...(q.freeOnly ? { feeAmount: 0 } : {}),
      ...(q.verifiedOnly ? { organization: { status: "VERIFIED" } } : {}),
    };

    const pool = await prisma.adoptionListing.findMany({
      where,
      select: CARD_SELECT,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: CANDIDATE_POOL,
    });

    const origin =
      typeof q.lat === "number" && typeof q.lng === "number" ? { lat: q.lat, lng: q.lng } : null;
    const ranked = rankListings(pool, {
      origin,
      maxDistanceKm: q.maxDistanceKm ?? null,
      sort: q.sort ?? (origin ? "DISTANCE" : "RECENT"),
    });

    const offset = q.offset ?? 0;
    const limit = q.limit ?? DEFAULT_LIMIT;
    const page = ranked.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      total: ranked.length,
      offset,
      limit,
      hasMore: offset + limit < ranked.length,
      listings: page.map((l) => serializeListingCard(l as ListingCardRow, now, l.distanceKm)),
    });
  } catch (err) {
    console.error("[GET /api/adoption/listings]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.feed" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * POST — create a DRAFT listing.
 *
 * Everything but the dog's name is optional here: the legal completeness gate
 * (OPAn art. 76d) runs at publication, in `checkListingLegality()`. Blocking a
 * half-filled draft would just push cédants to a competitor.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(listingCreateSchema, await req.json().catch(() => null), {
      route: "adoption.listings.create",
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // A verified organisation account publishes under its own badge.
    const org = await prisma.rescueOrganization.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true },
    });

    const listing = await prisma.adoptionListing.create({
      data: {
        userId: user.id,
        organizationId: org?.status === "VERIFIED" ? org.id : null,
        status: "DRAFT",
        dogName: body.dogName,
        breed: body.breed ?? null,
        secondaryBreed: body.secondaryBreed ?? null,
        isCrossbreed: body.isCrossbreed ?? false,
        sex: body.sex,
        birthDate: new Date(`${body.birthDate}T00:00:00.000Z`),
        sizeCategory: body.sizeCategory,
        weightKg: body.weightKg ?? null,
        neutered: body.neutered ?? null,
        vaccinated: body.vaccinated ?? null,
        dewormed: body.dewormed ?? null,
        microchipNumber: body.microchipNumber ?? null,
        provenance: body.provenance,
        breedingCountry: body.breedingCountry ?? "",
        cedantFullName: body.cedantFullName ?? "",
        cedantAddress: body.cedantAddress ?? "",
        cedantPostalCode: body.cedantPostalCode ?? "",
        cedantCity: body.cedantCity ?? "",
        feeAmount: body.feeAmount ?? 0,
        reason: body.reason ?? null,
        description: body.description ?? "",
        idealHome: body.idealHome ?? null,
        goodWithChildren: body.goodWithChildren ?? null,
        goodWithDogs: body.goodWithDogs ?? null,
        goodWithCats: body.goodWithCats ?? null,
        houseTrained: body.houseTrained ?? null,
        energyLevel: body.energyLevel ?? null,
        specialNeeds: body.specialNeeds ?? null,
        canton: body.canton ?? "",
        city: body.city ?? "",
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        photos: [],
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({ ok: true, listing }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/adoption/listings]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.create" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
