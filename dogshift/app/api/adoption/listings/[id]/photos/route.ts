import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { listingPhotoCommitSchema, listingPhotoOrderSchema } from "@/lib/validators/adoption";
import { isOwnedDogPhotoKey, MAX_LISTING_PHOTOS } from "@/lib/adoption/photos";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";
import { headObject } from "@/lib/r2";

export const runtime = "nodejs";

/** Load the listing and confirm the caller owns it. */
async function loadOwnListing(id: string, userId: string) {
  const row = await prisma.adoptionListing.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true, photos: true },
  });
  if (!row || row.userId !== userId) return null;
  return row;
}

function photosPayload(photos: string[]) {
  return photos.map((key, index) => ({ key, url: publicDogPhotoPath(key), position: index }));
}

/**
 * POST — commit an uploaded photo (phase 2 of presign → commit).
 *
 * Upload goes through the shared `/api/account/dogs/photo/presign`, which mints
 * keys under `dog-photos/<userId>/`. Two gates here, both required: the key must
 * carry the caller's own prefix (otherwise a cédant could attach someone else's
 * private dog photo to a public ad) and the object must actually exist in R2.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(listingPhotoCommitSchema, await req.json().catch(() => null), {
      route: "adoption.listings.photos.commit",
    });
    if (!parsed.ok) return parsed.response;
    const key = parsed.data.key.trim();

    const listing = await loadOwnListing(id, user.id);
    if (!listing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    if (!isOwnedDogPhotoKey(key, user.id)) {
      reportApiError({
        kind: "forbidden",
        code: "INVALID_PHOTO_KEY",
        route: "adoption.listings.photos.commit",
      });
      return NextResponse.json({ ok: false, error: "INVALID_PHOTO_KEY" }, { status: 403 });
    }
    if (listing.photos.includes(key)) {
      return NextResponse.json({ ok: true, photos: photosPayload(listing.photos) });
    }
    if (listing.photos.length >= MAX_LISTING_PHOTOS) {
      return NextResponse.json({ ok: false, error: "TOO_MANY_PHOTOS" }, { status: 409 });
    }

    try {
      await headObject({ key });
    } catch {
      return NextResponse.json({ ok: false, error: "UPLOAD_NOT_FOUND" }, { status: 404 });
    }

    const updated = await prisma.adoptionListing.update({
      where: { id },
      data: { photos: { push: key } },
      select: { photos: true },
    });

    return NextResponse.json({ ok: true, photos: photosPayload(updated.photos) });
  } catch (err) {
    console.error("[POST /api/adoption/listings/[id]/photos]", err);
    reportApiError({
      kind: "internal_error",
      code: "SERVER_ERROR",
      route: "adoption.listings.photos.commit",
    });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** PUT — reorder. The body must be a permutation of the current keys (index 0 = cover). */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(listingPhotoOrderSchema, await req.json().catch(() => null), {
      route: "adoption.listings.photos.order",
    });
    if (!parsed.ok) return parsed.response;
    const next = parsed.data.photos;

    const listing = await loadOwnListing(id, user.id);
    if (!listing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const current = [...listing.photos].sort();
    const proposed = [...next].sort();
    const isPermutation =
      current.length === proposed.length && current.every((key, i) => key === proposed[i]);
    if (!isPermutation) {
      return NextResponse.json({ ok: false, error: "PHOTO_SET_MISMATCH" }, { status: 400 });
    }

    const updated = await prisma.adoptionListing.update({
      where: { id },
      data: { photos: { set: next } },
      select: { photos: true },
    });
    return NextResponse.json({ ok: true, photos: photosPayload(updated.photos) });
  } catch (err) {
    console.error("[PUT /api/adoption/listings/[id]/photos]", err);
    reportApiError({
      kind: "internal_error",
      code: "SERVER_ERROR",
      route: "adoption.listings.photos.order",
    });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** DELETE ?key=… — detach a photo. The R2 object is left in place (cheap, auditable). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const key = (req.nextUrl.searchParams.get("key") ?? "").trim();
    if (!key) return NextResponse.json({ ok: false, error: "MISSING_KEY" }, { status: 400 });

    const listing = await loadOwnListing(id, user.id);
    if (!listing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (!listing.photos.includes(key)) {
      return NextResponse.json({ ok: false, error: "PHOTO_NOT_FOUND" }, { status: 404 });
    }

    const updated = await prisma.adoptionListing.update({
      where: { id },
      data: { photos: { set: listing.photos.filter((k) => k !== key) } },
      select: { photos: true },
    });
    return NextResponse.json({ ok: true, photos: photosPayload(updated.photos) });
  } catch (err) {
    console.error("[DELETE /api/adoption/listings/[id]/photos]", err);
    reportApiError({
      kind: "internal_error",
      code: "SERVER_ERROR",
      route: "adoption.listings.photos.delete",
    });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
