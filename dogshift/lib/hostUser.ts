import { auth } from "@clerk/nextjs/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getHostContractAmendmentState, type HostContractAmendmentState } from "@/lib/contractAmendments";
import { prisma } from "@/lib/prisma";
import { ensureDbUserFromClerkAuth } from "@/lib/auth/resolveDbUserId";
import { normalizeSitterLifecycleStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";

const DEFAULT_HOST_CONTRACT_AMENDMENT_STATE: HostContractAmendmentState = {
  activeAmendment: null,
  isUpToDate: true,
  acceptedAt: null,
  acceptedVersion: null,
  needsAcceptance: false,
};

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
  verificationStatus: string;
  stripeAccountStatus: string | null;
  contractSignedAt: string | null;
  activatedAt: string | null;
  activationCodeIssuedAt: string | null;
  contractAmendment: HostContractAmendmentState;
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
    verificationStatus: "not_verified",
    stripeAccountStatus: null,
    contractSignedAt: null,
    activatedAt: null,
    activationCodeIssuedAt: null,
    contractAmendment: DEFAULT_HOST_CONTRACT_AMENDMENT_STATE,
  };
}

export async function getHostUserData(): Promise<HostUserData> {
  const { userId } = await auth();
  if (!userId) {
    console.warn("[hostUser][diagnostic] auth returned no userId", {
      reason: "NO_AUTH_USER",
    });
    return {
      sitterId: null,
      published: false,
      publishedAt: null,
      profile: null,
      termsAcceptedAt: null,
      termsVersion: null,
      profileCompletion: 0,
      lifecycleStatus: "application_received",
      verificationStatus: "not_verified",
      stripeAccountStatus: null,
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
      contractAmendment: DEFAULT_HOST_CONTRACT_AMENDMENT_STATE,
    };
  }

  let user = (await (prisma as any).user.findUnique({ where: { clerkUserId: userId } })) as
    | ({ id: string; sitterId?: string | null; hostProfileJson?: string | null } & Record<string, unknown>)
    | null;

  console.info("[hostUser][diagnostic] initial user lookup", {
    clerkUserId: userId,
    foundUser: Boolean(user?.id),
    userSitterId: (user as any)?.sitterId ?? null,
  });

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
    console.warn("[hostUser][diagnostic] unable to resolve db user", {
      clerkUserId: userId,
      reason: "DB_USER_NOT_RESOLVED",
    });
    return {
      sitterId: null,
      published: false,
      publishedAt: null,
      profile: null,
      termsAcceptedAt: null,
      termsVersion: null,
      profileCompletion: 0,
      lifecycleStatus: "application_received",
      verificationStatus: "not_verified",
      stripeAccountStatus: null,
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
      contractAmendment: DEFAULT_HOST_CONTRACT_AMENDMENT_STATE,
    };
  }

  const sitterProfile = await (prisma as any).sitterProfile.findUnique({
    where: { userId: user.id },
    select: {
      sitterId: true,
      id: true,
      published: true,
      publishedAt: true,
      pricing: true,
      termsAcceptedAt: true,
      termsVersion: true,
      profileCompletion: true,
      lifecycleStatus: true,
      verificationStatus: true,
      contractVersion: true,
      contractSignedAt: true,
      activatedAt: true,
      activationCodeIssuedAt: true,
      stripeAccountStatus: true,
    },
  });

  console.info("[hostUser][diagnostic] sitterProfile lookup", {
    clerkUserId: userId,
    dbUserId: user.id,
    hasSitterProfile: Boolean(sitterProfile),
    persistedLifecycleStatus: sitterProfile?.lifecycleStatus ?? null,
    published: typeof sitterProfile?.published === "boolean" ? sitterProfile.published : null,
    contractSignedAt: sitterProfile?.contractSignedAt instanceof Date ? sitterProfile.contractSignedAt.toISOString() : null,
    activatedAt: sitterProfile?.activatedAt instanceof Date ? sitterProfile.activatedAt.toISOString() : null,
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
      verificationStatus: "not_verified",
      stripeAccountStatus: null,
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
      contractAmendment: DEFAULT_HOST_CONTRACT_AMENDMENT_STATE,
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
      verificationStatus: "not_verified",
      stripeAccountStatus: null,
      contractSignedAt: null,
      activatedAt: null,
      activationCodeIssuedAt: null,
      contractAmendment: DEFAULT_HOST_CONTRACT_AMENDMENT_STATE,
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
  const contractVersion = typeof sitterProfile?.contractVersion === "string" ? sitterProfile.contractVersion : null;
  const contractSignedAt = sitterProfile?.contractSignedAt instanceof Date ? sitterProfile.contractSignedAt.toISOString() : null;
  const activatedAt = sitterProfile?.activatedAt instanceof Date ? sitterProfile.activatedAt.toISOString() : null;
  const activationCodeIssuedAt = sitterProfile?.activationCodeIssuedAt instanceof Date ? sitterProfile.activationCodeIssuedAt.toISOString() : null;
  const contractAmendment = await getHostContractAmendmentState({
    sitterProfileId: typeof sitterProfile?.id === "string" ? sitterProfile.id : null,
    contractVersion,
  });
  const hostUserData: HostUserData = {
    sitterId,
    published: Boolean(sitterProfile?.published),
    publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
    profile,
    termsAcceptedAt,
    termsVersion,
    profileCompletion: typeof sitterProfile?.profileCompletion === "number" ? sitterProfile.profileCompletion : 0,
    lifecycleStatus,
    verificationStatus: typeof sitterProfile?.verificationStatus === "string" ? sitterProfile.verificationStatus : "not_verified",
    stripeAccountStatus: typeof sitterProfile?.stripeAccountStatus === "string" ? sitterProfile.stripeAccountStatus : null,
    contractSignedAt,
    activatedAt,
    activationCodeIssuedAt,
    contractAmendment,
  };
  console.info("[hostUser] loaded", {
    clerkUserId: userId,
    dbUserId: user.id,
    sitterId,
    termsAcceptedAt,
    termsVersion,
    profileCompletion: typeof sitterProfile?.profileCompletion === "number" ? sitterProfile.profileCompletion : 0,
    lifecycleStatus,
  });
  console.info("[hostUser][diagnostic] return payload", {
    clerkUserId: userId,
    dbUserId: user.id,
    sitterId: hostUserData.sitterId,
    lifecycleStatus: hostUserData.lifecycleStatus,
    profileCompletion: hostUserData.profileCompletion,
    contractSignedAt: hostUserData.contractSignedAt,
    activatedAt: hostUserData.activatedAt,
  });

  return hostUserData;
}
