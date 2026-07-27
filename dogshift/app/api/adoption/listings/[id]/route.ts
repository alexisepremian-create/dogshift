import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { listingUpdateSchema } from "@/lib/validators/adoption";
import { serializeListingDetail, type ListingDetailRow } from "@/lib/adoption/serialize";
import { haversineKm } from "@/lib/adoption/geo";

export const runtime = "nodejs";

/** Statuses a non-owner is allowed to see. */
const PUBLIC_STATUSES = ["PUBLISHED", "PENDING", "ADOPTED"];

/**
 * GET — full detail sheet.
 *
 * A DRAFT or ARCHIVED listing is 404 for everyone but its author. ADOPTED stays
 * visible on purpose: adopters follow up on dogs they applied for, and hiding a
 * successful placement is exactly what makes shelter sites feel like dead ends.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();

    const row = await prisma.adoptionListing.findUnique({
      where: { id },
      include: { organization: { select: { id: true, name: true, status: true, logoUrl: true } } },
    });
    if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const isOwner = Boolean(user && row.userId === user.id);
    if (!isOwner && !PUBLIC_STATUSES.includes(row.status)) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // The breed warning must be read against the *adopter's* canton: the same
    // dog can be legal where it lives and banned where it would move to.
    const adopter = user
      ? await prisma.adopterProfile.findUnique({
          where: { userId: user.id },
          select: { canton: true, city: true },
        })
      : null;

    const myApplication = user
      ? await prisma.adoptionApplication.findUnique({
          where: { listingId_userId: { listingId: row.id, userId: user.id } },
          select: { id: true, status: true, createdAt: true, thread: { select: { id: true } } },
        })
      : null;

    // The client forwards the position it already used for the feed so the
    // sheet shows the same distance as the card it was opened from.
    const originLat = Number(req.nextUrl.searchParams.get("lat"));
    const originLng = Number(req.nextUrl.searchParams.get("lng"));
    const distanceKm =
      Number.isFinite(originLat) &&
      Number.isFinite(originLng) &&
      typeof row.lat === "number" &&
      typeof row.lng === "number"
        ? haversineKm({ lat: originLat, lng: originLng }, { lat: row.lat, lng: row.lng })
        : null;

    return NextResponse.json({
      ok: true,
      listing: serializeListingDetail(row as ListingDetailRow, new Date(), {
        viewerCanton: adopter?.canton ?? null,
        isOwner,
        distanceKm,
      }),
      myApplication,
    });
  } catch (err) {
    console.error("[GET /api/adoption/listings/[id]]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.detail" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * PATCH — edit the listing.
 *
 * Editable while DRAFT, PUBLISHED or PENDING. ADOPTED and ARCHIVED are frozen:
 * a listing that already produced a cession is part of the paper trail behind
 * the AMICUS declaration, so it must not be rewritten after the fact.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(listingUpdateSchema, await req.json().catch(() => null), {
      route: "adoption.listings.update",
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const existing = await prisma.adoptionListing.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (existing.status === "ADOPTED" || existing.status === "ARCHIVED") {
      return NextResponse.json({ ok: false, error: "LISTING_LOCKED" }, { status: 409 });
    }

    const data: Prisma.AdoptionListingUpdateInput = {};
    const assign = <K extends keyof Prisma.AdoptionListingUpdateInput>(
      key: K,
      value: Prisma.AdoptionListingUpdateInput[K] | undefined
    ) => {
      if (value !== undefined) data[key] = value;
    };

    assign("dogName", body.dogName);
    assign("breed", body.breed);
    assign("secondaryBreed", body.secondaryBreed);
    assign("isCrossbreed", body.isCrossbreed);
    assign("sex", body.sex);
    if (body.birthDate !== undefined) data.birthDate = new Date(`${body.birthDate}T00:00:00.000Z`);
    assign("sizeCategory", body.sizeCategory);
    assign("weightKg", body.weightKg);
    assign("neutered", body.neutered);
    assign("vaccinated", body.vaccinated);
    assign("dewormed", body.dewormed);
    assign("microchipNumber", body.microchipNumber);
    assign("provenance", body.provenance);
    assign("breedingCountry", body.breedingCountry);
    assign("cedantFullName", body.cedantFullName);
    assign("cedantAddress", body.cedantAddress);
    assign("cedantPostalCode", body.cedantPostalCode);
    assign("cedantCity", body.cedantCity);
    assign("feeAmount", body.feeAmount);
    assign("reason", body.reason);
    assign("description", body.description);
    assign("idealHome", body.idealHome);
    assign("goodWithChildren", body.goodWithChildren);
    assign("goodWithDogs", body.goodWithDogs);
    assign("goodWithCats", body.goodWithCats);
    assign("houseTrained", body.houseTrained);
    assign("energyLevel", body.energyLevel);
    assign("specialNeeds", body.specialNeeds);
    assign("canton", body.canton);
    assign("city", body.city);
    assign("lat", body.lat);
    assign("lng", body.lng);

    const updated = await prisma.adoptionListing.update({
      where: { id },
      data,
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json({ ok: true, listing: updated });
  } catch (err) {
    console.error("[PATCH /api/adoption/listings/[id]]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.update" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** DELETE — only a DRAFT can be deleted; anything published gets archived. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const existing = await prisma.adoptionListing.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (existing.status !== "DRAFT") {
      return NextResponse.json({ ok: false, error: "ARCHIVE_INSTEAD" }, { status: 409 });
    }

    await prisma.adoptionListing.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/adoption/listings/[id]]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.delete" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
