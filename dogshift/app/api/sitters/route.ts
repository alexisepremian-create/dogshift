/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSitterReviewSnapshot } from "@/lib/sitterReviews";
import { resolvePublicEnabledServices } from "@/lib/sitterEnabledServices";

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
  capacityPlaces: number | null;
  acceptsSmall: boolean | null;
  acceptsMedium: boolean | null;
  acceptsLarge: boolean | null;
  neuteredRequired: boolean | null;
  averageRating: number | null;
  countReviews: number;
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
  capacityPlaces?: number;
  acceptsSmall?: boolean;
  acceptsMedium?: boolean;
  acceptsLarge?: boolean;
  neuteredRequired?: boolean;
  updatedAt: Date;
  user: { name: string | null; image: string | null } | null;
};

export async function GET(req: NextRequest) {
  void req;
  try {
    const db = prisma as unknown as { sitterProfile: { findMany: (args: unknown) => Promise<DbRow[]> } };

    const baseSelect = {
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
      user: { select: { name: true, image: true } },
    };

    const capacityFields = {
      capacityPlaces: true,
      acceptsSmall: true,
      acceptsMedium: true,
      acceptsLarge: true,
      neuteredRequired: true,
    };

    let sitters: DbRow[];
    try {
      sitters = await db.sitterProfile.findMany({
        where: { published: true },
        orderBy: { updatedAt: "desc" },
        select: { ...baseSelect, ...capacityFields },
      });
    } catch {
      // Capacity columns may not exist yet if migration hasn't run
      sitters = await db.sitterProfile.findMany({
        where: { published: true },
        orderBy: { updatedAt: "desc" },
        select: baseSelect,
      });
    }

    const sitterIds = sitters
      .map((s) => String(s.sitterId ?? "").trim())
      .filter((id): id is string => Boolean(id));

    const configRows: { sitterId: string; serviceType: string; enabled: boolean }[] = [];
    if (sitterIds.length > 0) {
      const raw = (await (prisma as any).serviceConfig.findMany({
        where: { sitterId: { in: sitterIds } },
        select: { sitterId: true, serviceType: true, enabled: true },
      })) as { sitterId?: unknown; serviceType?: unknown; enabled?: unknown }[];
      for (const row of raw ?? []) {
        const sid = String(row?.sitterId ?? "").trim();
        if (!sid) continue;
        configRows.push({
          sitterId: sid,
          serviceType: String(row?.serviceType ?? ""),
          enabled: Boolean(row?.enabled),
        });
      }
    }

    const configsBySitter = new Map<string, { serviceType: string; enabled: boolean }[]>();
    for (const row of configRows) {
      const list = configsBySitter.get(row.sitterId) ?? [];
      list.push(row);
      configsBySitter.set(row.sitterId, list);
    }

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
        services: resolvePublicEnabledServices({
          serviceConfigs: configsBySitter.get(String(s.sitterId ?? "")) ?? [],
          pricing: s.pricing,
          servicesJson: s.services,
        }),
        pricing: s.pricing ?? null,
        dogSizes: s.dogSizes ?? null,
        capacityPlaces: s.capacityPlaces ?? null,
        acceptsSmall: s.acceptsSmall ?? null,
        acceptsMedium: s.acceptsMedium ?? null,
        acceptsLarge: s.acceptsLarge ?? null,
        neuteredRequired: s.neuteredRequired ?? null,
        averageRating,
        countReviews,
        updatedAt: s.updatedAt.toISOString(),
      };
    })
    );

    const rows: SitterListItem[] = rowsRaw.filter((row): row is SitterListItem => Boolean(row?.sitterId));

    const anyDb = prisma as unknown as { sitterProfile?: { count?: (args: unknown) => Promise<number> } };
    const totalCount = typeof anyDb.sitterProfile?.count === "function" ? await anyDb.sitterProfile.count({}) : null;
    const publishedCount =
      typeof anyDb.sitterProfile?.count === "function" ? await anyDb.sitterProfile.count({ where: { published: true } }) : null;

    return NextResponse.json(
      { ok: true, sitters: rows, _counts: { total: totalCount, published: publishedCount, returned: rows.length } },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][sitters] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
