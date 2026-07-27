import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { listingPublishSchema } from "@/lib/validators/adoption";
import { checkListingLegality } from "@/lib/adoption/legal";
import { checkBreedRestriction } from "@/lib/adoption/breedRestrictions";

export const runtime = "nodejs";

/**
 * POST — publish a listing.
 *
 * This is the endpoint OPAn art. 76d al. 2 is about: the duty to ensure a
 * dog-cession ad is complete falls on the *platform operator*, not on the
 * person publishing. So the completeness check runs server-side, against the
 * persisted row (never against the request body), and it blocks.
 *
 * The cantonal breed verdict is returned but does NOT block: a breed banned in
 * Geneva is perfectly adoptable from Geneva by someone in Bern. Blocking would
 * be us inventing a rule that doesn't exist.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(listingPublishSchema, await req.json().catch(() => null), {
      route: "adoption.listings.publish",
    });
    if (!parsed.ok) return parsed.response;

    const row = await prisma.adoptionListing.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (row.status !== "DRAFT" && row.status !== "ARCHIVED") {
      return NextResponse.json({ ok: false, error: "ALREADY_PUBLISHED" }, { status: 409 });
    }

    const now = new Date();
    const legality = checkListingLegality(
      {
        microchipNumber: row.microchipNumber,
        provenance: row.provenance,
        breedingCountry: row.breedingCountry,
        cedantFullName: row.cedantFullName,
        cedantAddress: row.cedantAddress,
        cedantPostalCode: row.cedantPostalCode,
        cedantCity: row.cedantCity,
        birthDate: row.birthDate,
        photos: row.photos,
        description: row.description,
      },
      now
    );
    if (!legality.ok) {
      reportApiError({
        kind: "validation_error",
        code: "LISTING_INCOMPLETE",
        route: "adoption.listings.publish",
        extra: { issues: legality.issues.map((i) => i.field) },
      });
      return NextResponse.json(
        { ok: false, error: "LISTING_INCOMPLETE", issues: legality.issues },
        { status: 400 }
      );
    }

    if (!row.canton || !row.city) {
      return NextResponse.json(
        {
          ok: false,
          error: "LISTING_INCOMPLETE",
          issues: [{ field: "canton", message: "Indique le canton et la localité du chien." }],
        },
        { status: 400 }
      );
    }

    const updated = await prisma.adoptionListing.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: row.publishedAt ?? now,
        lastConfirmedAt: now,
        acceptedTermsAt: now,
        archivedAt: null,
      },
      select: { id: true, status: true, publishedAt: true },
    });

    const restriction = checkBreedRestriction({
      canton: row.canton,
      breed: row.breed,
      secondaryBreed: row.secondaryBreed,
      isCrossbreed: row.isCrossbreed,
    });

    return NextResponse.json({
      ok: true,
      listing: updated,
      breedRestriction: restriction.level === "NONE" ? null : restriction,
    });
  } catch (err) {
    console.error("[POST /api/adoption/listings/[id]/publish]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.publish" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
