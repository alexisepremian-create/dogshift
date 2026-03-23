import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { getSitterReviewSnapshot, type SitterReviewItem } from "@/lib/sitterReviews";
import { isActivatedStatus, normalizeSitterLifecycleStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";

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
  verified: boolean;
  lifecycleStatus: SitterLifecycleStatus;
  trustBadgeEligible: boolean;
  lat: number | null;
  lng: number | null;
  countReviews: number;
  averageRating: number | null;
  reviews: SitterReviewItem[];
};

function normalizePersistedPricing(raw: unknown) {
  if (!raw || typeof raw !== "object") return {} as Record<string, number>;
  const obj = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  if (typeof obj.Promenade === "number" && Number.isFinite(obj.Promenade) && obj.Promenade > 0) out.Promenade = obj.Promenade;
  if (typeof obj.Garde === "number" && Number.isFinite(obj.Garde) && obj.Garde > 0) out.Garde = obj.Garde;
  if (typeof obj.Pension === "number" && Number.isFinite(obj.Pension) && obj.Pension > 0) out.Pension = obj.Pension;
  return out;
}

function serviceLabelForType(serviceType: string) {
  if (serviceType === "PROMENADE") return "Promenade";
  if (serviceType === "DOGSITTING") return "Garde";
  if (serviceType === "PENSION") return "Pension";
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sitterId: string } | Promise<{ sitterId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const viewModeRaw = (searchParams.get("mode") ?? "").trim();
    const isPreviewMode = viewModeRaw === "preview";
    const viewerId = isPreviewMode ? await resolveDbUserId(req) : null;

    const resolvedParams = (typeof (params as any)?.then === "function"
      ? await (params as Promise<{ sitterId: string }>)
      : (params as { sitterId: string })) as { sitterId: string };

    const sitterIdRaw = typeof resolvedParams?.sitterId === "string" ? resolvedParams.sitterId : "";
    const input = sitterIdRaw.trim();

    if (!input) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    let sitterId = input;
    if (!sitterId.startsWith("s-")) {
      const userDelegate = (prisma as any)?.user;
      if (userDelegate && typeof userDelegate.findUnique === "function") {
        const byId = await userDelegate.findUnique({ where: { id: sitterId }, select: { sitterId: true } });
        const normalizedById = typeof byId?.sitterId === "string" ? byId.sitterId.trim() : "";
        if (normalizedById) {
          sitterId = normalizedById;
        } else {
          const bySitterId = await userDelegate.findUnique({ where: { sitterId }, select: { sitterId: true } });
          const normalizedBySitterId = typeof bySitterId?.sitterId === "string" ? bySitterId.sitterId.trim() : "";
          if (normalizedBySitterId) sitterId = normalizedBySitterId;
        }
      }
    }

    const db = prisma as unknown as { sitterProfile: any };
    const sitterProfile = await db.sitterProfile.findFirst({
      where: {
        sitterId,
      },
      select: {
        sitterId: true,
        userId: true,
        published: true,
        displayName: true,
        city: true,
        postalCode: true,
        bio: true,
        avatarUrl: true,
        verificationStatus: true,
        lifecycleStatus: true,
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

    if (!sitterProfile.published) {
      const ownerByPreview = Boolean(isPreviewMode && viewerId && sitterProfile.userId === viewerId);
      if (ownerByPreview) {
        // Allow preview for the profile owner.
      } else {
        if (process.env.NODE_ENV !== "production") {
          return NextResponse.json({ ok: false, error: "NOT_PUBLISHED" }, { status: 403 });
        }
        return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      }
    }

    const name = String((sitterProfile.displayName ?? sitterProfile.user?.name ?? "") ?? "").trim();
    const pricing = normalizePersistedPricing(sitterProfile.pricing);

    const serviceConfigs = await (prisma as any).serviceConfig.findMany({
      where: { sitterId },
      select: { serviceType: true, enabled: true },
    });

    const enabledServicesFromConfig = Array.isArray(serviceConfigs)
      ? serviceConfigs
          .filter((row) => row && row.enabled === true)
          .map((row) => serviceLabelForType(String(row.serviceType ?? "")))
          .filter((value): value is NonNullable<ReturnType<typeof serviceLabelForType>> => value !== null)
      : [];

    const enabledServices = enabledServicesFromConfig.length
      ? enabledServicesFromConfig
      : Object.keys(pricing).filter((svc) => svc === "Promenade" || svc === "Garde" || svc === "Pension");
    const lifecycleStatus = normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, Boolean(sitterProfile.published));
    const verified = typeof (sitterProfile as any)?.verificationStatus === "string" ? (sitterProfile as any).verificationStatus === "approved" : false;

    const sitter: SitterDetail = {
      sitterId: String(sitterProfile.sitterId ?? ""),
      name,
      city: sitterProfile.city ?? "",
      postalCode: sitterProfile.postalCode ?? "",
      bio: sitterProfile.bio ?? "",
      avatarUrl: sitterProfile.avatarUrl ?? sitterProfile.user?.image ?? null,
      services: enabledServices,
      pricing,
      dogSizes: sitterProfile.dogSizes ?? null,
      verified,
      lifecycleStatus,
      trustBadgeEligible: verified && isActivatedStatus(lifecycleStatus),
      lat: typeof sitterProfile.lat === "number" && Number.isFinite(sitterProfile.lat) ? sitterProfile.lat : null,
      lng: typeof sitterProfile.lng === "number" && Number.isFinite(sitterProfile.lng) ? sitterProfile.lng : null,
      countReviews: 0,
      averageRating: null,
      reviews: [],
    };

    try {
      const snapshot = await getSitterReviewSnapshot(sitterId);
      sitter.countReviews = snapshot.countReviews;
      sitter.averageRating = snapshot.averageRating;
      sitter.reviews = snapshot.reviews;
    } catch (err) {
      console.error("[api][sitters][sitterId] review aggregate failed", err);
    }

    return NextResponse.json({ ok: true, sitter }, { status: 200 });
  } catch (err) {
    console.error("[api][sitters][sitterId] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
