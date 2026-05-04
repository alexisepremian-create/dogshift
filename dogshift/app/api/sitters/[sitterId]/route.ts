/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { getSitterReviewSnapshot, type SitterReviewItem } from "@/lib/sitterReviews";
import { normalizeSitterLifecycleStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";
import {
  normalizePersistedPublicPricing,
  resolvePublicEnabledServices,
} from "@/lib/sitterEnabledServices";

export const runtime = "nodejs";

/** Public sitter detail must not be cached: HTML shell is dynamic and JSON must stay fresh for profile edits. */
const NO_STORE_JSON_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
} as const;

type BoardingDetails = {
  housingType?: "Appartement" | "Maison" | null;
  hasGarden?: boolean | null;
  hasOtherPets?: boolean | null;
  notes?: string | null;
};

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
  maxDogsBySize: unknown;
  boardingDetails: BoardingDetails | null;
  verified: boolean;
  lifecycleStatus: SitterLifecycleStatus;
  trustBadgeEligible: boolean;
  lat: number | null;
  lng: number | null;
  hasAddress: boolean;
  countReviews: number;
  averageRating: number | null;
  reviews: SitterReviewItem[];
};

function extractBoardingDetails(raw: unknown): BoardingDetails | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const housingType =
    obj.housingType === "Appartement" || obj.housingType === "Maison" ? obj.housingType : null;
  const hasGarden = typeof obj.hasGarden === "boolean" ? obj.hasGarden : null;
  const hasOtherPets = typeof obj.hasOtherPets === "boolean" ? obj.hasOtherPets : null;
  const notes =
    typeof obj.notes === "string" && obj.notes.trim().length > 0 ? obj.notes.trim() : null;
  if (!housingType && hasGarden == null && hasOtherPets == null && !notes) return null;
  return { housingType, hasGarden, hasOtherPets, notes };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sitterId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const viewModeRaw = (searchParams.get("mode") ?? "").trim();
    const isPreviewMode = viewModeRaw === "preview";
    const viewerId = isPreviewMode ? await resolveDbUserId(req) : null;

    const resolvedParams = await params;

    const sitterIdRaw = typeof resolvedParams?.sitterId === "string" ? resolvedParams.sitterId : "";
    const input = sitterIdRaw.trim();

    if (!input) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: NO_STORE_JSON_HEADERS });
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
        maxDogsBySize: true,
        user: { select: { image: true, hostProfileJson: true } },
      },
    });

    if (!sitterProfile) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE_JSON_HEADERS });
    }

    if (!sitterProfile.published) {
      const ownerByPreview = Boolean(isPreviewMode && viewerId && sitterProfile.userId === viewerId);
      if (ownerByPreview) {
        // Allow preview for the profile owner.
      } else {
        if (process.env.NODE_ENV !== "production") {
          return NextResponse.json({ ok: false, error: "NOT_PUBLISHED" }, { status: 403, headers: NO_STORE_JSON_HEADERS });
        }
        return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404, headers: NO_STORE_JSON_HEADERS });
      }
    }

    const name = String(sitterProfile.displayName ?? "").trim();
    const pricing = normalizePersistedPublicPricing(sitterProfile.pricing);

    // Pull fields we only persist in hostProfileJson (bio fallback, boarding details).
    let resolvedBio = sitterProfile.bio ?? "";
    let boardingDetails: BoardingDetails | null = null;
    try {
      const raw = typeof sitterProfile.user?.hostProfileJson === "string" ? sitterProfile.user.hostProfileJson : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!resolvedBio) {
          const jsonBio = typeof parsed?.bio === "string" ? parsed.bio.trim() : "";
          if (jsonBio) resolvedBio = jsonBio;
        }
        boardingDetails = extractBoardingDetails(parsed?.boardingDetails);
      }
    } catch {
      // ignore malformed JSON
    }

    const serviceConfigs = await (prisma as any).serviceConfig.findMany({
      where: { sitterId },
      select: { serviceType: true, enabled: true },
    });

    const enabledServices = resolvePublicEnabledServices({
      serviceConfigs: Array.isArray(serviceConfigs)
        ? serviceConfigs.map((row: { serviceType?: unknown; enabled?: unknown }) => ({
            serviceType: String(row?.serviceType ?? ""),
            enabled: Boolean(row?.enabled),
          }))
        : [],
      pricing: sitterProfile.pricing,
      servicesJson: sitterProfile.services,
    });
    const lifecycleStatus = normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, Boolean(sitterProfile.published));
    const verified = typeof (sitterProfile as any)?.verificationStatus === "string" ? (sitterProfile as any).verificationStatus === "approved" : false;

    const sitter: SitterDetail = {
      sitterId: String(sitterProfile.sitterId ?? ""),
      name,
      city: sitterProfile.city ?? "",
      postalCode: sitterProfile.postalCode ?? "",
      bio: resolvedBio,
      avatarUrl: sitterProfile.avatarUrl ?? sitterProfile.user?.image ?? null,
      services: enabledServices,
      pricing,
      dogSizes: sitterProfile.dogSizes ?? null,
      maxDogsBySize: (sitterProfile as any).maxDogsBySize ?? null,
      boardingDetails,
      verified,
      lifecycleStatus,
      trustBadgeEligible: false,
      lat: typeof sitterProfile.lat === "number" && Number.isFinite(sitterProfile.lat) ? sitterProfile.lat : null,
      lng: typeof sitterProfile.lng === "number" && Number.isFinite(sitterProfile.lng) ? sitterProfile.lng : null,
      hasAddress: typeof sitterProfile.lat === "number" && Number.isFinite(sitterProfile.lat) && typeof sitterProfile.lng === "number" && Number.isFinite(sitterProfile.lng),
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

    return NextResponse.json({ ok: true, sitter }, { status: 200, headers: NO_STORE_JSON_HEADERS });
  } catch (err) {
    console.error("[api][sitters][sitterId] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, headers: NO_STORE_JSON_HEADERS });
  }
}
