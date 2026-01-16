import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export type HostUserData = {
  sitterId: string | null;
  published: boolean;
  publishedAt: string | null;
  profile: unknown;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  profileCompletion: number;
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
    };
  }

  let user = (await (prisma as any).user.findUnique({ where: { clerkUserId: userId } })) as
    | ({ id: string; sitterId?: string | null; hostProfileJson?: string | null } & Record<string, unknown>)
    | null;

  if (!user) {
    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) {
      throw new Error("[hostUser] missing primary email for ensureDbUser");
    }

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId: userId,
      email: primaryEmail,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (ensured?.id) {
      user = (await (prisma as any).user.findUnique({ where: { id: ensured.id } })) as
        | ({ id: string; sitterId?: string | null; hostProfileJson?: string | null } & Record<string, unknown>)
        | null;
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
    };
  }

  const sitterProfile = await prisma.sitterProfile.findUnique({
    where: { userId: user.id },
    select: {
      sitterId: true,
      published: true,
      publishedAt: true,
      termsAcceptedAt: true,
      termsVersion: true,
      profileCompletion: true,
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

  const termsAcceptedAt = sitterProfile?.termsAcceptedAt instanceof Date ? sitterProfile.termsAcceptedAt.toISOString() : null;
  const termsVersion = typeof sitterProfile?.termsVersion === "string" ? sitterProfile.termsVersion : null;
  console.info("[hostUser] loaded", {
    clerkUserId: userId,
    dbUserId: user.id,
    sitterId,
    termsAcceptedAt,
    termsVersion,
    profileCompletion: typeof sitterProfile?.profileCompletion === "number" ? sitterProfile.profileCompletion : 0,
  });

  return {
    sitterId,
    published: Boolean(sitterProfile?.published),
    publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
    profile,
    termsAcceptedAt,
    termsVersion,
    profileCompletion: typeof sitterProfile?.profileCompletion === "number" ? sitterProfile.profileCompletion : 0,
  };
}
