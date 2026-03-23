import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
import { normalizeSitterLifecycleStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";

function normalizePersistedPricing(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const pricing: Record<string, number> = {};
  if (typeof obj.Promenade === "number" && Number.isFinite(obj.Promenade) && obj.Promenade > 0) pricing.Promenade = obj.Promenade;
  if (typeof obj.Garde === "number" && Number.isFinite(obj.Garde) && obj.Garde > 0) pricing.Garde = obj.Garde;
  if (typeof obj.Pension === "number" && Number.isFinite(obj.Pension) && obj.Pension > 0) pricing.Pension = obj.Pension;
  return pricing;
}

export type HostUserData = {
  sitterId: string | null;
  published: boolean;
  publishedAt: string | null;
  profile: unknown;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  profileCompletion: number;
  lifecycleStatus: SitterLifecycleStatus;
  contractSignedAt: string | null;
  activatedAt: string | null;
  activationCodeIssuedAt: string | null;
};

export function makeHostUserValuePreview(args: {
  sitterId: string | null;
  profile: unknown;
}): HostUserData {
  return {
    sitterId: args.sitterId,
    published: false,
    publishedAt: null,
    profile: args.profile,
    termsAcceptedAt: null,
    termsVersion: null,
    profileCompletion: 0,
    lifecycleStatus: "application_received",
    contractSignedAt: null,
    activatedAt: null,
    activationCodeIssuedAt: null,
  };
}

export async function getHostUserData(): Promise<HostUserData> {
  const { userId } = await auth();
  if (!userId) {
    return {
      sitterId: null,
      published: false,
      publishedAt: null,
      profile: null,
      termsAcceptedAt: null,
      termsVersion: null,
      profileCompletion: 0,
      lifecycleStatus: "application_received",
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
    };
  }

  let user = (await (prisma as any).user.findUnique({ where: { clerkUserId: userId } })) as
    | ({ id: string; sitterId?: string | null; hostProfileJson?: string | null } & Record<string, unknown>)
    | null;

  if (!user) {
    const ensured = await ensureDbUserFromClerkAuth();
    if (ensured?.id) {
      user = (await (prisma as any).user.findUnique({ where: { id: ensured.id } })) as
        | ({ id: string; sitterId?: string | null; hostProfileJson?: string | null } & Record<string, unknown>)
        | null;
      console.info("[hostUser] ensured db user from clerk auth", {
        clerkUserId: userId,
        dbUserId: ensured.id,
        created: ensured.created,
      });
    } else {
      console.warn("[hostUser] failed to ensure db user from clerk auth", {
        clerkUserId: userId,
      });
    }
  }

  if (!user?.id) {
    return {
      sitterId: null,
      published: false,
      publishedAt: null,
      profile: null,
      termsAcceptedAt: null,
      termsVersion: null,
      profileCompletion: 0,
      lifecycleStatus: "application_received",
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
    };
  }

  const sitterProfile = await (prisma as any).sitterProfile.findUnique({
    where: { userId: user.id },
    select: {
      sitterId: true,
      published: true,
      publishedAt: true,
      pricing: true,
      termsAcceptedAt: true,
      termsVersion: true,
      profileCompletion: true,
      lifecycleStatus: true,
      contractSignedAt: true,
      activatedAt: true,
      activationCodeIssuedAt: true,
    },
  });

  // Authorization rule: allow /host ONLY if a SitterProfile exists for this DB user.
  if (!sitterProfile) {
    console.info("[hostUser] no sitterProfile", { clerkUserId: userId, dbUserId: user.id });
    return {
      sitterId: null,
      published: false,
      publishedAt: null,
      profile: null,
      termsAcceptedAt: null,
      termsVersion: null,
      profileCompletion: 0,
      lifecycleStatus: "application_received",
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
    };
  }

  const sitterId = typeof sitterProfile.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : null;

  if (!sitterId) {
    console.info("[hostUser] missing sitterId", { clerkUserId: userId, dbUserId: user.id });
    return {
      sitterId: null,
      published: false,
      publishedAt: null,
      profile: null,
      termsAcceptedAt: null,
      termsVersion: null,
      profileCompletion: 0,
      lifecycleStatus: "application_received",
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
    };
  }

  const userSitterId = (user as unknown as { sitterId?: string | null }).sitterId ?? null;
  if (userSitterId !== sitterId) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { sitterId } as unknown as Record<string, unknown>,
      });
    } catch {
      // ignore
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

  const persistedPricing = normalizePersistedPricing(sitterProfile?.pricing);
  if (persistedPricing) {
    const baseProfile = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};
    const currentPricing =
      baseProfile.pricing && typeof baseProfile.pricing === "object" ? (baseProfile.pricing as Record<string, unknown>) : {};
    profile = {
      ...baseProfile,
      pricing: {
        ...currentPricing,
        ...persistedPricing,
      },
    };
  }

  const termsAcceptedAt = sitterProfile?.termsAcceptedAt instanceof Date ? sitterProfile.termsAcceptedAt.toISOString() : null;
  const termsVersion = typeof sitterProfile?.termsVersion === "string" ? sitterProfile.termsVersion : null;
  const lifecycleStatus = normalizeSitterLifecycleStatus(sitterProfile?.lifecycleStatus, Boolean(sitterProfile?.published));
  const contractSignedAt = sitterProfile?.contractSignedAt instanceof Date ? sitterProfile.contractSignedAt.toISOString() : null;
  const activatedAt = sitterProfile?.activatedAt instanceof Date ? sitterProfile.activatedAt.toISOString() : null;
  const activationCodeIssuedAt = sitterProfile?.activationCodeIssuedAt instanceof Date ? sitterProfile.activationCodeIssuedAt.toISOString() : null;
  console.info("[hostUser] loaded", {
    clerkUserId: userId,
    dbUserId: user.id,
    sitterId,
    termsAcceptedAt,
    termsVersion,
    profileCompletion: typeof sitterProfile?.profileCompletion === "number" ? sitterProfile.profileCompletion : 0,
    lifecycleStatus,
  });

  return {
    sitterId,
    published: Boolean(sitterProfile?.published),
    publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
    profile,
    termsAcceptedAt,
    termsVersion,
    profileCompletion: typeof sitterProfile?.profileCompletion === "number" ? sitterProfile.profileCompletion : 0,
    lifecycleStatus,
    contractSignedAt,
    activatedAt,
    activationCodeIssuedAt,
  };
}
