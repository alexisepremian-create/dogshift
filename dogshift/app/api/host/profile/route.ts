/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { buildEffectiveSitterCompletionProfile, computeSitterProfileCompletion } from "@/lib/sitterCompletion";
import { checkSitterSensitiveActionGate } from "@/lib/sitterGuards";
import { getHostContractAmendmentState } from "@/lib/contractAmendments";
import { isActivatedStatus, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { geocodeSwissLocation } from "@/lib/geocode";
import { isPersistedAvatarMediaPath } from "@/lib/sitterAvatarMedia";
import { zodParse } from "@/lib/validators/common";
import { hostProfileUpdateSchema } from "@/lib/validators/sitter";

export const runtime = "nodejs";

const PILOT_TARIFF_RANGES: Record<string, { min: number; max: number }> = {
  Promenade: { min: 15, max: 25 },
  Garde: { min: 18, max: 30 },
  Pension: { min: 35, max: 60 },
};

function validatePilotTariffs({ enabledServices, pricingObj }: { enabledServices: string[]; pricingObj: Record<string, unknown> }) {
  for (const svc of enabledServices) {
    const range = PILOT_TARIFF_RANGES[svc];
    if (!range) continue;
    const raw = pricingObj?.[svc];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    if (raw < range.min || raw > range.max) {
      return {
        ok: false as const,
        error: "TARIFF_OUT_OF_RANGE" as const,
        details: `Tarif ${svc} : le prix doit être compris entre ${range.min} et ${range.max} CHF.`,
      };
    }
  }
  return { ok: true as const };
}


function generateSitterId() {
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function GET(req: NextRequest) {
  try {
    void req;
    const { userId } = await auth();
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][profile][GET] UNAUTHORIZED", { hasUserId: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email: primaryEmail,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const uid = ensured.id;

    const hasSitterProfile = await (prisma as any).sitterProfile.findUnique({ where: { userId: uid }, select: { id: true } });
    if (!hasSitterProfile) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let sitterId = (user as unknown as { sitterId?: string | null }).sitterId ?? null;
    if (!sitterId) {
      sitterId = generateSitterId();
      try {
        await prisma.user.update({
          where: { id: uid },
          data: { sitterId } as unknown as Record<string, unknown>,
        });
      } catch {
        const refreshed = await prisma.user.findUnique({ where: { id: uid } });
        sitterId = (refreshed as unknown as { sitterId?: string | null } | null)?.sitterId ?? sitterId;
      }
    }
    const hostProfileJson = (user as unknown as { hostProfileJson?: string | null }).hostProfileJson ?? null;

    let profile: unknown = null;
    if (hostProfileJson) {
      try {
        profile = JSON.parse(hostProfileJson) as unknown;
      } catch {
        profile = null;
      }
    }

    const sitterProfile = await (prisma as any).sitterProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        sitterId,
        published: false,
        publishedAt: null,
        lifecycleStatus: normalizeSitterLifecycleStatus("application_received", false),
      },
      update: {
        sitterId,
      },
      select: {
        published: true,
        publishedAt: true,
        pricing: true,
        profileCompletion: true,
        termsAcceptedAt: true,
        termsVersion: true,
        verificationStatus: true,
        lifecycleStatus: true,
        contractSignedAt: true,
        activatedAt: true,
        activationCodeIssuedAt: true,
        stripeAccountStatus: true,
        avatarUrl: true,
      },
    });

    const serviceConfigs = await (prisma as any).serviceConfig.findMany({
      where: { sitterId },
      select: { serviceType: true, enabled: true },
    });

    const enabledServiceTypes = Array.isArray(serviceConfigs)
      ? serviceConfigs.filter((row) => row && row.enabled === true).map((row) => String(row.serviceType ?? ""))
      : [];

    const builtCompletionProfile = buildEffectiveSitterCompletionProfile({
      profile,
      enabledServiceTypes,
      persistedPricing: sitterProfile?.pricing,
    });
    const persistedAvatarUrl = typeof (sitterProfile as any)?.avatarUrl === "string" ? (sitterProfile as any).avatarUrl : null;
    const mergedProfile: Record<string, unknown> = {
      ...(builtCompletionProfile && typeof builtCompletionProfile === "object" ? builtCompletionProfile : {}),
      stripeAccountStatus: typeof sitterProfile?.stripeAccountStatus === "string" ? sitterProfile.stripeAccountStatus : null,
    };
    if (isPersistedAvatarMediaPath(persistedAvatarUrl)) {
      mergedProfile.avatarUrl = persistedAvatarUrl;
      delete mergedProfile.avatarDataUrl;
    } else if (persistedAvatarUrl && !(builtCompletionProfile as Record<string, unknown>)?.avatarDataUrl) {
      mergedProfile.avatarUrl = persistedAvatarUrl;
    }

    const computedProfileCompletion = computeSitterProfileCompletion(mergedProfile);
    const persistedProfileCompletion =
      typeof sitterProfile?.profileCompletion === "number" && Number.isFinite(sitterProfile.profileCompletion)
        ? sitterProfile.profileCompletion
        : null;
    const resolvedProfileCompletion = computedProfileCompletion;

    if (persistedProfileCompletion !== computedProfileCompletion) {
      await prisma.sitterProfile.update({
        where: { userId: uid },
        data: { profileCompletion: computedProfileCompletion },
        select: { id: true },
      });
    }

    const lifecycleStatus = normalizeSitterLifecycleStatus(sitterProfile?.lifecycleStatus, Boolean(sitterProfile?.published));

    return NextResponse.json(
      {
        ok: true,
        sitterId,
        published: Boolean(sitterProfile?.published),
        publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
        profileCompletion: resolvedProfileCompletion,
        termsAcceptedAt: sitterProfile?.termsAcceptedAt instanceof Date ? sitterProfile.termsAcceptedAt.toISOString() : null,
        termsVersion: typeof sitterProfile?.termsVersion === "string" ? sitterProfile.termsVersion : null,
        lifecycleStatus,
        contractSignedAt: sitterProfile?.contractSignedAt instanceof Date ? sitterProfile.contractSignedAt.toISOString() : null,
        activatedAt: sitterProfile?.activatedAt instanceof Date ? sitterProfile.activatedAt.toISOString() : null,
        activationCodeIssuedAt: sitterProfile?.activationCodeIssuedAt instanceof Date ? sitterProfile.activationCodeIssuedAt.toISOString() : null,
        profile: mergedProfile,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][profile][GET] error", err);
    const message = err instanceof Error ? err.message : "";
    const code = (typeof err === "object" && err ? (err as Record<string, unknown>).code : undefined) as string | undefined;

    if (typeof message === "string" && /no such column/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_SCHEMA_MISMATCH", details: message }, { status: 500 });
    }
    if (typeof message === "string" && /database is locked/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_LOCKED", details: message }, { status: 503 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        details: code ? `${code}${message ? `: ${message}` : ""}` : message || undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email: primaryEmail,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const uid = ensured.id;

    const hasSitterProfile = await prisma.sitterProfile.findUnique({ where: { userId: uid }, select: { id: true } });
    if (!hasSitterProfile) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const parsedBody = zodParse(hostProfileUpdateSchema, rawBody);
    if (!parsedBody.ok) return parsedBody.response;

    const body = parsedBody.data as unknown;

    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    let sitterId = (user as unknown as { sitterId?: string | null }).sitterId ?? null;

    if (!sitterId) {
      sitterId = generateSitterId();
      await prisma.user.update({
        where: { id: uid },
        data: { sitterId } as unknown as Record<string, unknown>,
      });
    }

    if (!sitterId) {
      return NextResponse.json({ ok: false, error: "MISSING_SITTER_ID" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const normalized = {
      ...b,
      sitterId,
      profileVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    const jsonForStorage: Record<string, unknown> = { ...(normalized as Record<string, unknown>) };
    const pathAvatar = typeof (b as Record<string, unknown>).avatarUrl === "string" ? String((b as Record<string, unknown>).avatarUrl).trim() : "";
    if (isPersistedAvatarMediaPath(pathAvatar)) {
      jsonForStorage.avatarUrl = pathAvatar;
      delete jsonForStorage.avatarDataUrl;
    } else {
      const rawData = jsonForStorage.avatarDataUrl;
      if (typeof rawData === "string" && rawData.length > 120_000) {
        delete jsonForStorage.avatarDataUrl;
      }
    }

    await prisma.user.update({
      where: { id: uid },
      data: { hostProfileJson: JSON.stringify(jsonForStorage) } as unknown as Record<string, unknown>,
    });

    const publishedFlagRaw = (b as Record<string, unknown>)?.published;
    const publishedFlag = typeof publishedFlagRaw === "boolean"
      ? publishedFlagRaw
      : (b as Record<string, unknown>)?.listingStatus === "published" || Boolean((b as Record<string, unknown>)?.publishedAt);

    const servicesObjRaw = (b as Record<string, unknown>)?.services;
    const servicesObj = servicesObjRaw && typeof servicesObjRaw === "object" ? (servicesObjRaw as Record<string, unknown>) : {};
    const enabledServices = Object.keys(servicesObj).filter((k) => Boolean(servicesObj[k]));
    const pricingObjRaw = (b as Record<string, unknown>)?.pricing;
    const pricingObj = pricingObjRaw && typeof pricingObjRaw === "object" ? (pricingObjRaw as Record<string, unknown>) : {};
    const dogSizesObjRaw = (b as Record<string, unknown>)?.dogSizes;
    const dogSizesObj = dogSizesObjRaw && typeof dogSizesObjRaw === "object" ? (dogSizesObjRaw as Record<string, unknown>) : {};
    const enabledDogSizes = Object.keys(dogSizesObj).filter((k) => Boolean(dogSizesObj[k]));
    const maxDogsBySizeRaw = (b as Record<string, unknown>)?.maxDogsBySize;
    const maxDogsBySizeObj = maxDogsBySizeRaw && typeof maxDogsBySizeRaw === "object" ? (maxDogsBySizeRaw as Record<string, unknown>) : null;

    const avatarDataUrl = typeof (b as Record<string, unknown>)?.avatarDataUrl === "string" ? String((b as Record<string, unknown>).avatarDataUrl).trim() : "";
    let resolvedAvatarForColumn: string | null = null;
    if (isPersistedAvatarMediaPath(pathAvatar)) {
      resolvedAvatarForColumn = pathAvatar;
    } else if (avatarDataUrl) {
      resolvedAvatarForColumn = avatarDataUrl;
    }

    const displayName = typeof (b as Record<string, unknown>)?.firstName === "string" && String((b as Record<string, unknown>).firstName).trim()
      ? String((b as Record<string, unknown>).firstName).trim()
      : null;
    const city = typeof (b as Record<string, unknown>)?.city === "string" ? String((b as Record<string, unknown>).city).trim() : null;
    const postalCode = typeof (b as Record<string, unknown>)?.postalCode === "string" ? String((b as Record<string, unknown>).postalCode).trim() : null;
    const bio = typeof (b as Record<string, unknown>)?.bio === "string" ? String((b as Record<string, unknown>).bio).trim() : null;
    const address = typeof (b as Record<string, unknown>)?.address === "string" ? String((b as Record<string, unknown>).address).trim() : null;

    const latRaw = (b as Record<string, unknown>)?.lat;
    const lngRaw = (b as Record<string, unknown>)?.lng;
    const latProvided = typeof latRaw === "number" && Number.isFinite(latRaw) ? latRaw : null;
    const lngProvided = typeof lngRaw === "number" && Number.isFinite(lngRaw) ? lngRaw : null;

    const existingProfile = await (prisma as any).sitterProfile.findUnique({
      where: { userId: uid },
      select: {
        id: true,
        published: true,
        publishedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        profileCompletion: true,
        verificationStatus: true,
        lifecycleStatus: true,
        contractSignedAt: true,
        contractVersion: true,
        stripeAccountStatus: true,
      },
    });

    const completion = computeSitterProfileCompletion({
      ...(jsonForStorage && typeof jsonForStorage === "object" ? jsonForStorage : {}),
      ...(typeof existingProfile?.verificationStatus === "string"
        ? {
            verificationStatus:
              existingProfile.verificationStatus === "approved"
                ? "verified"
                : existingProfile.verificationStatus === "not_verified"
                  ? "unverified"
                  : existingProfile.verificationStatus,
          }
        : null),
      stripeAccountStatus: existingProfile?.stripeAccountStatus ?? null,
    });

    if (pricingObj && typeof pricingObj === "object" && Object.keys(pricingObj).length > 0) {
      const pilotCheck = validatePilotTariffs({ enabledServices, pricingObj });
      if (!pilotCheck.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: pilotCheck.error,
            details: pilotCheck.details,
          },
          { status: 400 }
        );
      }
    }

    const wantsPublish = Boolean(publishedFlag);
    const isCurrentlyPublished = Boolean(existingProfile?.published);
    const attemptingFirstPublish = wantsPublish && !isCurrentlyPublished;
    let publishBlocked: null | { error: string; status: number; profileCompletion?: number; termsVersion: string } = null;

    const lifecycleStatus = normalizeSitterLifecycleStatus(existingProfile?.lifecycleStatus, Boolean(existingProfile?.published));

    if (attemptingFirstPublish) {
      const inviteActivated = isActivatedStatus(lifecycleStatus) && !existingProfile?.contractSignedAt;
      const contractAmendmentState = await getHostContractAmendmentState({
        sitterProfileId: existingProfile?.id ?? null,
        contractVersion: typeof existingProfile?.contractVersion === "string" ? existingProfile.contractVersion : null,
      });
      const gate = checkSitterSensitiveActionGate({
        termsAcceptedAt: existingProfile?.termsAcceptedAt ?? null,
        termsVersion: existingProfile?.termsVersion ?? null,
        profileCompletion: completion,
        lifecycleStatus,
        isContractAmendmentUpToDate: contractAmendmentState.isUpToDate,
        skipContractChecks: inviteActivated,
      });

      if (!gate.ok) {
        publishBlocked = {
          error: gate.error,
          status: gate.status,
          ...(gate.error === "PROFILE_INCOMPLETE" ? { profileCompletion: gate.profileCompletion } : null),
          termsVersion: CURRENT_TERMS_VERSION,
        };
      }
    }

    const willPublish = wantsPublish && !(attemptingFirstPublish && publishBlocked);
    const publishedAt = willPublish
      ? (existingProfile?.publishedAt ?? new Date())
      : null;

    let finalLat: number | null = latProvided;
    let finalLng: number | null = lngProvided;

    // Geocode from address (precise) first, then fall back to city/postalCode.
    if (address) {
      const { geocodeAddress } = await import("@/lib/travel/geocode");
      const coords = await geocodeAddress(address);
      if (coords) {
        finalLat = coords.lat;
        finalLng = coords.lng;
      }
    }

    if (finalLat == null || finalLng == null) {
      if (willPublish && city && postalCode) {
        const existingCoords = await prisma.sitterProfile.findUnique({
          where: { userId: uid },
          select: { lat: true, lng: true },
        });

        const hasCoords =
          typeof existingCoords?.lat === "number" &&
          Number.isFinite(existingCoords.lat) &&
          typeof existingCoords?.lng === "number" &&
          Number.isFinite(existingCoords.lng);

        if (hasCoords) {
          finalLat = existingCoords?.lat ?? null;
          finalLng = existingCoords?.lng ?? null;
        } else {
          const coords = await geocodeSwissLocation({ city, postalCode });
          if (coords) {
            finalLat = coords.lat;
            finalLng = coords.lng;
          }
        }
      }
    }

    const updateData: Record<string, unknown> = {
      sitterId,
      published: willPublish,
      publishedAt,
      profileCompletion: completion,
    };

    // Non-destructive updates: only apply if client actually provided meaningful values.
    if (displayName) updateData.displayName = displayName;
    if (city) updateData.city = city;
    if (postalCode) updateData.postalCode = postalCode;
    if (bio) updateData.bio = bio;
    if (address) updateData.address = address;
    if (resolvedAvatarForColumn) updateData.avatarUrl = resolvedAvatarForColumn;
    if (Array.isArray(enabledServices) && enabledServices.length > 0) updateData.services = enabledServices as Prisma.InputJsonValue;
    if (pricingObj && typeof pricingObj === "object" && Object.keys(pricingObj).length > 0) updateData.pricing = pricingObj as Prisma.InputJsonValue;
    if (Array.isArray(enabledDogSizes) && enabledDogSizes.length > 0) updateData.dogSizes = enabledDogSizes as Prisma.InputJsonValue;
    if (maxDogsBySizeObj) updateData.maxDogsBySize = maxDogsBySizeObj as Prisma.InputJsonValue;

    if (finalLat != null && finalLng != null) {
      updateData.lat = finalLat;
      updateData.lng = finalLng;
    }

    await (prisma as any).sitterProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        sitterId,
        published: willPublish,
        publishedAt,
        lifecycleStatus,
        displayName,
        city,
        postalCode,
        bio,
        address,
        avatarUrl: resolvedAvatarForColumn,
        lat: finalLat,
        lng: finalLng,
        services: enabledServices as Prisma.InputJsonValue,
        pricing: pricingObj as Prisma.InputJsonValue,
        dogSizes: enabledDogSizes as Prisma.InputJsonValue,
        maxDogsBySize: maxDogsBySizeObj as Prisma.InputJsonValue,
        profileCompletion: completion,
      },
      update: updateData,
      select: { id: true },
    });

    return NextResponse.json(
      {
        ok: true,
        sitterId,
        published: willPublish,
        profileCompletion: completion,
        lifecycleStatus,
        publishBlocked,
        profile: jsonForStorage,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][host][profile][POST] error", err);
    const message = err instanceof Error ? err.message : "";
    const code = (typeof err === "object" && err ? (err as Record<string, unknown>).code : undefined) as string | undefined;

    if (typeof message === "string" && /no such column/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_SCHEMA_MISMATCH", details: message }, { status: 500 });
    }
    if (typeof message === "string" && /database is locked/i.test(message)) {
      return NextResponse.json({ ok: false, error: "DB_LOCKED", details: message }, { status: 503 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        details: code ? `${code}${message ? `: ${message}` : ""}` : message || undefined,
      },
      { status: 500 }
    );
  }
}
