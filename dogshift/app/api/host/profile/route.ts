import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { computeSitterProfileCompletion } from "@/lib/sitterCompletion";
import { checkSitterSensitiveActionGate } from "@/lib/sitterGuards";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const runtime = "nodejs";


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

    const hasSitterProfile = await prisma.sitterProfile.findUnique({ where: { userId: uid }, select: { id: true } });
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

    const sitterProfile = await prisma.sitterProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        sitterId,
        published: false,
        publishedAt: null,
      },
      update: {
        sitterId,
      },
      select: { published: true, publishedAt: true, profileCompletion: true, termsAcceptedAt: true, termsVersion: true },
    });

    return NextResponse.json(
      {
        ok: true,
        sitterId,
        published: Boolean(sitterProfile?.published),
        publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
        profileCompletion: typeof sitterProfile?.profileCompletion === "number" ? sitterProfile.profileCompletion : 0,
        termsAcceptedAt: sitterProfile?.termsAcceptedAt instanceof Date ? sitterProfile.termsAcceptedAt.toISOString() : null,
        termsVersion: typeof sitterProfile?.termsVersion === "string" ? sitterProfile.termsVersion : null,
        profile,
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

    const body = (await req.json()) as unknown;

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

    const hostProfileJson = JSON.stringify(normalized);

    await prisma.user.update({
      where: { id: uid },
      data: { hostProfileJson } as unknown as Record<string, unknown>,
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

    const avatarDataUrl = typeof (b as Record<string, unknown>)?.avatarDataUrl === "string" ? String((b as Record<string, unknown>).avatarDataUrl) : "";
    const avatarUrl = avatarDataUrl.trim() ? avatarDataUrl.trim() : null;

    const displayName = typeof (b as Record<string, unknown>)?.firstName === "string" && String((b as Record<string, unknown>).firstName).trim()
      ? String((b as Record<string, unknown>).firstName).trim()
      : null;
    const city = typeof (b as Record<string, unknown>)?.city === "string" ? String((b as Record<string, unknown>).city).trim() : null;
    const postalCode = typeof (b as Record<string, unknown>)?.postalCode === "string" ? String((b as Record<string, unknown>).postalCode).trim() : null;
    const bio = typeof (b as Record<string, unknown>)?.bio === "string" ? String((b as Record<string, unknown>).bio).trim() : null;

    const existingProfile = await prisma.sitterProfile.findUnique({
      where: { userId: uid },
      select: {
        published: true,
        publishedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        profileCompletion: true,
      },
    });

    const completion = computeSitterProfileCompletion(normalized);

    const wantsPublish = Boolean(publishedFlag);
    if (wantsPublish) {
      const gate = checkSitterSensitiveActionGate({
        termsAcceptedAt: existingProfile?.termsAcceptedAt ?? null,
        termsVersion: existingProfile?.termsVersion ?? null,
        profileCompletion: completion,
      });
      if (!gate.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: gate.error,
            ...(gate.error === "PROFILE_INCOMPLETE" ? { profileCompletion: gate.profileCompletion } : null),
            termsVersion: CURRENT_TERMS_VERSION,
          },
          { status: gate.status }
        );
      }
    }

    const willPublish = wantsPublish;
    const publishedAt = willPublish
      ? (existingProfile?.publishedAt ?? new Date())
      : null;

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
    if (avatarUrl) updateData.avatarUrl = avatarUrl;
    if (Array.isArray(enabledServices) && enabledServices.length > 0) updateData.services = enabledServices as Prisma.InputJsonValue;
    if (pricingObj && typeof pricingObj === "object" && Object.keys(pricingObj).length > 0) updateData.pricing = pricingObj as Prisma.InputJsonValue;
    if (Array.isArray(enabledDogSizes) && enabledDogSizes.length > 0) updateData.dogSizes = enabledDogSizes as Prisma.InputJsonValue;

    await prisma.sitterProfile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        sitterId,
        published: willPublish,
        publishedAt,
        displayName,
        city,
        postalCode,
        bio,
        avatarUrl,
        services: enabledServices as Prisma.InputJsonValue,
        pricing: pricingObj as Prisma.InputJsonValue,
        dogSizes: enabledDogSizes as Prisma.InputJsonValue,
        profileCompletion: completion,
      },
      update: updateData,
      select: { id: true },
    });

    return NextResponse.json({ ok: true, sitterId, profile: normalized }, { status: 200 });
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
