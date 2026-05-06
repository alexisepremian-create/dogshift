import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sitterId: string }> }
) {
  try {
    const resolvedParams = await params;
    const sitterId = typeof resolvedParams?.sitterId === "string" ? resolvedParams.sitterId : "";

    if (!sitterId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const sitterProfile = await prisma.sitterProfile.findFirst({
      where: {
        sitterId,
        published: true,
      },
      select: {
        sitterId: true,
        displayName: true,
        city: true,
        postalCode: true,
        bio: true,
        avatarUrl: true,
        verificationStatus: true,
        lat: true,
        lng: true,
        services: true,
        pricing: true,
        dogSizes: true,
        capacityPlaces: true,
        acceptsSmall: true,
        acceptsMedium: true,
        acceptsLarge: true,
        neuteredRequired: true,
        acceptanceCriteria: true,
        maxDogsBySize: true,
        updatedAt: true,
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    if (!sitterProfile) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const name = String((sitterProfile.displayName ?? sitterProfile.user?.name ?? "") ?? "").trim();

    return NextResponse.json(
      {
        ok: true,
        sitter: {
          sitterId: String(sitterProfile.sitterId),
          name,
          image: sitterProfile.avatarUrl ?? sitterProfile.user?.image ?? null,
        },
        profile: {
          sitterId: String(sitterProfile.sitterId),
          displayName: sitterProfile.displayName ?? null,
          city: sitterProfile.city ?? null,
          postalCode: sitterProfile.postalCode ?? null,
          bio: sitterProfile.bio ?? null,
          avatarUrl: sitterProfile.avatarUrl ?? null,
          verified: sitterProfile.verificationStatus === "approved",
          lat: sitterProfile.lat ?? null,
          lng: sitterProfile.lng ?? null,
          services: sitterProfile.services ?? null,
          pricing: sitterProfile.pricing ?? null,
          dogSizes: sitterProfile.dogSizes ?? null,
          capacityPlaces: sitterProfile.capacityPlaces ?? null,
          acceptsSmall: sitterProfile.acceptsSmall ?? null,
          acceptsMedium: sitterProfile.acceptsMedium ?? null,
          acceptsLarge: sitterProfile.acceptsLarge ?? null,
          neuteredRequired: sitterProfile.neuteredRequired ?? null,
          acceptanceCriteria: sitterProfile.acceptanceCriteria ?? null,
          maxDogsBySize: sitterProfile.maxDogsBySize ?? null,
          updatedAt: sitterProfile.updatedAt instanceof Date ? sitterProfile.updatedAt.toISOString() : sitterProfile.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][sitter][id] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
