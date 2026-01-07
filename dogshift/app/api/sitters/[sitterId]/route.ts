import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SitterDetail = {
  sitterId: string;
  name: string;
  city: string;
  postalCode: string;
  bio: string;
  avatarUrl: string | null;
  services: unknown;
  pricing: unknown;
  dogSizes: unknown;
  lat: number | null;
  lng: number | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { sitterId: string } | Promise<{ sitterId: string }> }
) {
  try {
    const resolvedParams = (typeof (params as any)?.then === "function"
      ? await (params as Promise<{ sitterId: string }>)
      : (params as { sitterId: string })) as { sitterId: string };

    const sitterId = typeof resolvedParams?.sitterId === "string" ? resolvedParams.sitterId : "";

    if (!sitterId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const db = prisma as unknown as { sitterProfile: any };
    const sitterProfile = await db.sitterProfile.findFirst({
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
        lat: true,
        lng: true,
        services: true,
        pricing: true,
        dogSizes: true,
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

    const sitter: SitterDetail = {
      sitterId: String(sitterProfile.sitterId ?? ""),
      name,
      city: sitterProfile.city ?? "",
      postalCode: sitterProfile.postalCode ?? "",
      bio: sitterProfile.bio ?? "",
      avatarUrl: sitterProfile.avatarUrl ?? sitterProfile.user?.image ?? null,
      services: sitterProfile.services ?? null,
      pricing: sitterProfile.pricing ?? null,
      dogSizes: sitterProfile.dogSizes ?? null,
      lat: typeof sitterProfile.lat === "number" && Number.isFinite(sitterProfile.lat) ? sitterProfile.lat : null,
      lng: typeof sitterProfile.lng === "number" && Number.isFinite(sitterProfile.lng) ? sitterProfile.lng : null,
    };

    return NextResponse.json({ ok: true, sitter }, { status: 200 });
  } catch (err) {
    console.error("[api][sitters][sitterId] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
