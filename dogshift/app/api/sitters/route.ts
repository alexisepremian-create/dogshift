import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSitterReviewSnapshot } from "@/lib/sitterReviews";

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
  averageRating: number | null;
  countReviews: number;
  updatedAt: string;
};

const SERVICE_ORDER = ["Promenade", "Garde", "Pension"] as const;

function normalizePublicServices(raw: unknown) {
  const found = new Set<(typeof SERVICE_ORDER)[number]>();
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (value === "Promenade" || value === "Garde" || value === "Pension") found.add(value);
    }
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of SERVICE_ORDER) {
      if (obj[key] === true) found.add(key);
    }
  }
  return SERVICE_ORDER.filter((service) => found.has(service));
}

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

    const rowsRaw = await Promise.all(
      sitters.map(async (s: DbRow): Promise<SitterListItem | null> => {
      const name = String(s.displayName ?? "").trim();
      if (!String(s.sitterId ?? "").trim()) return null;
      let averageRating: number | null = null;
      let countReviews = 0;
      try {
        const snapshot = await getSitterReviewSnapshot(String(s.sitterId ?? ""));
        averageRating = snapshot.averageRating;
        countReviews = snapshot.countReviews;
      } catch (err) {
        console.error("[api][sitters] review aggregate failed", err);
      }
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
        services: normalizePublicServices(s.services),
        pricing: s.pricing ?? null,
        dogSizes: s.dogSizes ?? null,
        averageRating,
        countReviews,
        updatedAt: s.updatedAt.toISOString(),
      };
    })
    );

    const rows: SitterListItem[] = rowsRaw.filter((row): row is SitterListItem => Boolean(row?.sitterId));

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
