import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SitterListItem = {
  sitterId: string;
  name: string;
  city: string;
  postalCode: string;
  bio: string;
  avatarUrl: string | null;
  verified: boolean;
  lat: number | null;
  lng: number | null;
  services: unknown;
  pricing: unknown;
  dogSizes: unknown;
  updatedAt: string;
};

type DbRow = {
  sitterId: string;
  displayName: string | null;
  city: string | null;
  postalCode: string | null;
  bio: string | null;
  avatarUrl: string | null;
  verificationStatus?: string | null;
  lat: number | null;
  lng: number | null;
  services: unknown;
  pricing: unknown;
  dogSizes: unknown;
  updatedAt: Date;
  user: { name: string | null; image: string | null } | null;
};

export async function GET(_req: NextRequest) {
  try {
    const db = prisma as unknown as { sitterProfile: { findMany: (args: unknown) => Promise<DbRow[]> } };
    const sitters = await db.sitterProfile.findMany({
      where: { published: true },
      orderBy: { updatedAt: "desc" },
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
        updatedAt: true,
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    const rows: SitterListItem[] = sitters
      .map((s: DbRow): SitterListItem => {
      const name = String((s.displayName ?? s.user?.name ?? "") ?? "").trim();
      return {
        sitterId: String(s.sitterId ?? ""),
        name,
        city: s.city ?? "",
        postalCode: s.postalCode ?? "",
        bio: s.bio ?? "",
        avatarUrl: s.avatarUrl ?? s.user?.image ?? null,
        verified: typeof s.verificationStatus === "string" ? s.verificationStatus === "approved" : false,
        lat: typeof s.lat === "number" && Number.isFinite(s.lat) ? s.lat : null,
        lng: typeof s.lng === "number" && Number.isFinite(s.lng) ? s.lng : null,
        services: s.services ?? null,
        pricing: s.pricing ?? null,
        dogSizes: s.dogSizes ?? null,
        updatedAt: s.updatedAt.toISOString(),
      };
    })
      .filter((row: SitterListItem) => Boolean(row.sitterId));

    if (process.env.NODE_ENV !== "production") {
      const anyDb = prisma as unknown as { sitterProfile?: { count?: (args: unknown) => Promise<number> } };
      const total = typeof anyDb.sitterProfile?.count === "function" ? await anyDb.sitterProfile.count({}) : null;
      const publishedCount =
        typeof anyDb.sitterProfile?.count === "function" ? await anyDb.sitterProfile.count({ where: { published: true } }) : null;

      return NextResponse.json({ ok: true, sitters: rows, debug: { total, published: publishedCount } }, { status: 200 });
    }

    return NextResponse.json({ ok: true, sitters: rows }, { status: 200 });
  } catch (err) {
    console.error("[api][sitters] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
