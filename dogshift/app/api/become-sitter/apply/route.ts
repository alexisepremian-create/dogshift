import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { computeSitterProfileCompletion } from "@/lib/sitterCompletion";
import { maxSitterLifecycleStatus, normalizeSitterLifecycleStatus } from "@/lib/sitterContract";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const inviteId = req.cookies.get("dogsitter_invite_id")?.value ?? null;
    const activationProfileId = req.cookies.get("ds_activation_profile_id")?.value ?? null;

    if (!inviteId && !activationProfileId) {
      return NextResponse.json({ ok: false, error: "INVITE_REQUIRED" }, { status: 403 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
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

    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const now = new Date();

    // --- Activation-code path: skip InviteCode DB check ---
    // The activation code was already validated and the profile already set to "activated"
    // by /api/host/activation-code. We just need to update the profile with the form data.
    type InviteRow = { id: string; type: string; usedAt: Date | null; expiresAt: Date | null };
    let invite: InviteRow | null = null;
    if (inviteId) {
      invite = (await prisma.inviteCode.findUnique({
        where: { id: inviteId },
        select: { id: true, type: true, usedAt: true, expiresAt: true },
      })) as InviteRow | null;

      if (!invite) {
        return NextResponse.json({ ok: false, error: "INVITE_INVALID" }, { status: 403 });
      }

      if (invite.expiresAt instanceof Date && invite.expiresAt.getTime() <= now.getTime()) {
        return NextResponse.json({ ok: false, error: "INVITE_EXPIRED" }, { status: 403 });
      }

      if (invite.type === "single_use" && invite.usedAt) {
        return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 403 });
      }
    }

    const payload = body as Record<string, unknown>;
    const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
    const city = typeof payload.city === "string" ? payload.city.trim() : "";
    const bio = typeof payload.bio === "string" ? payload.bio.trim() : "";
    const avatarDataUrl = typeof payload.avatarDataUrl === "string" ? payload.avatarDataUrl : null;
    const services = typeof payload.services === "object" && payload.services ? payload.services : null;
    const walkRate = typeof payload.walkRate === "number" ? payload.walkRate : null;
    const sittingRate = typeof payload.sittingRate === "number" ? payload.sittingRate : null;
    // Backward compat: legacy clients sending a single hourlyRate for both.
    const legacyHourly = typeof payload.hourlyRate === "number" ? payload.hourlyRate : null;
    const effectiveWalkRate = walkRate ?? legacyHourly;
    const effectiveSittingRate = sittingRate ?? legacyHourly;
    const pricePerDay = typeof payload.pricePerDay === "number" ? payload.pricePerDay : null;
    const termsAccepted = payload.termsAccepted === true;

    if (!termsAccepted) {
      return NextResponse.json({ ok: false, error: "TERMS_REQUIRED" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { id: ensured.id }, select: { sitterId: true } });
    const sitterId = (existingUser?.sitterId && existingUser.sitterId.trim())
      ? existingUser.sitterId.trim()
      : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const hostProfile: Record<string, unknown> = {
      profileVersion: 1,
      sitterId,
      firstName,
      city,
      postalCode: "",
      avatarDataUrl,
      bio,
      services: {
        Promenade: Array.isArray(services) ? services.includes("Promenade") : false,
        Garde: Array.isArray(services) ? services.includes("Garde") : false,
        Pension: Array.isArray(services) ? services.includes("Pension") : false,
      },
      pricing: {
        Promenade: Array.isArray(services) && services.includes("Promenade") && typeof effectiveWalkRate === "number" ? effectiveWalkRate : undefined,
        Garde: Array.isArray(services) && services.includes("Garde") && typeof effectiveSittingRate === "number" ? effectiveSittingRate : undefined,
        Pension: Array.isArray(services) && services.includes("Pension") && typeof pricePerDay === "number" ? pricePerDay : undefined,
      },
      dogSizes: { Petit: false, Moyen: false, Grand: false },
      cancellationFlexible: true,
      boardingDetails: undefined,
      verificationStatus: "unverified",
      listingStatus: "draft",
      publishedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    const completion = computeSitterProfileCompletion(hostProfile);
    const hostProfileJson = JSON.stringify(hostProfile);
    const lifecycleStatus = normalizeSitterLifecycleStatus("activated", true);

    console.info("[become-sitter][apply] auto-activating sitter", {
      clerkUserId: userId,
      dbUserId: ensured.id,
      email: primaryEmail,
      inviteId: invite?.id ?? null,
      inviteType: invite?.type ?? null,
      activationProfileId: activationProfileId ?? null,
      lifecycleStatus,
    });

    await prisma.$transaction(async (tx) => {
      if (invite && invite.type === "single_use") {
        const updated = await tx.inviteCode.updateMany({
          where: { id: invite.id, usedAt: null },
          data: { usedAt: now },
        });
        if (updated.count !== 1) {
          throw new Error("INVITE_ALREADY_USED");
        }
      }

      await tx.user.update({
        where: { id: ensured.id },
        data: { role: "SITTER", sitterId, hostProfileJson } as unknown as Record<string, unknown>,
        select: { id: true },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingProfile = await (tx as any).sitterProfile.findUnique({
        where: { userId: ensured.id },
        select: {
          lifecycleStatus: true,
          published: true,
        },
      });
      const currentLifecycleStatus = existingProfile
        ? normalizeSitterLifecycleStatus(existingProfile.lifecycleStatus, existingProfile.published)
        : null;
      const nextLifecycleStatus = currentLifecycleStatus
        ? maxSitterLifecycleStatus(currentLifecycleStatus, lifecycleStatus)
        : lifecycleStatus;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).sitterProfile.upsert({
        where: { userId: ensured.id },
        create: {
          userId: ensured.id,
          sitterId,
          published: false,
          publishedAt: null,
          lifecycleStatus,
          activatedAt: now,
          termsAcceptedAt: now,
          termsVersion: CURRENT_TERMS_VERSION,
          profileCompletion: completion,
          displayName: firstName || null,
          city: city || null,
          bio: bio || null,
          avatarUrl: avatarDataUrl,
          services: services as Prisma.InputJsonValue,
          pricing: {
            walkRate: effectiveWalkRate,
            sittingRate: effectiveSittingRate,
            pricePerDay,
          } as Prisma.InputJsonValue,
          dogSizes: [] as unknown as Prisma.InputJsonValue,
        },
        update: {
          sitterId,
          published: false,
          publishedAt: null,
          lifecycleStatus: nextLifecycleStatus,
          activatedAt: now,
          termsAcceptedAt: now,
          termsVersion: CURRENT_TERMS_VERSION,
          profileCompletion: completion,
          displayName: firstName || null,
          city: city || null,
          bio: bio || null,
          avatarUrl: avatarDataUrl,
          services: services as Prisma.InputJsonValue,
          pricing: {
            walkRate: effectiveWalkRate,
            sittingRate: effectiveSittingRate,
            pricePerDay,
          } as Prisma.InputJsonValue,
          dogSizes: [] as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    });

    // Telegram admin notification — best-effort, never blocks the response.
    void sendTelegramMessage(
      `🐾 *Nouveau dogsitter inscrit !*\n👤 ${firstName || "Inconnu"}\n📍 ${city || "?"}\n📧 ${primaryEmail}\n🆔 ${ensured.id}\n🏠 Services : ${Array.isArray(services) ? services.join(", ") : "?"}`
    ).catch((e) => console.warn("[become-sitter][apply] telegram notification failed", e));

    return NextResponse.json({ ok: true, sitterId, activated: true }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "INVITE_ALREADY_USED") {
      return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 403 });
    }
    console.error("[api][become-sitter][apply] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
