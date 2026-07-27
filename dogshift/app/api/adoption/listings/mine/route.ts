import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { serializeListingCard, type ListingCardRow } from "@/lib/adoption/serialize";
import { checkListingLegality } from "@/lib/adoption/legal";

export const runtime = "nodejs";

/**
 * GET — the cédant's own listings, every status included.
 *
 * Each row carries `legalIssues`: the same blocking checks the publish endpoint
 * runs, surfaced early so the composer can show what is still missing instead
 * of failing at the last step.
 */
export async function GET() {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const rows = await prisma.adoptionListing.findMany({
      where: { userId: user.id },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        organization: { select: { id: true, name: true, status: true, logoUrl: true } },
        _count: { select: { applications: true } },
      },
    });

    const now = new Date();
    return NextResponse.json({
      ok: true,
      listings: rows.map((row) => ({
        ...serializeListingCard(row as ListingCardRow, now),
        pendingApplications: row._count.applications,
        lastConfirmedAt: row.lastConfirmedAt,
        adoptedAt: row.adoptedAt,
        archivedAt: row.archivedAt,
        legalIssues: checkListingLegality(
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
        ).issues,
      })),
    });
  } catch (err) {
    console.error("[GET /api/adoption/listings/mine]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.listings.mine" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
