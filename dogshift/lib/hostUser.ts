import { auth, currentUser } from "@clerk/nextjs/server";
import { unstable_cache as cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export type HostUserData = {
  sitterId: string | null;
  published: boolean;
  publishedAt: string | null;
  profile: unknown;
};

export async function getHostUserData(): Promise<HostUserData> {
  const { userId } = await auth();
  if (!userId) {
    return { sitterId: null, published: false, publishedAt: null, profile: null };
  }

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) {
    return { sitterId: null, published: false, publishedAt: null, profile: null };
  }

  const load = cache(
    async (email: string): Promise<HostUserData> => {
      const ensured = await ensureDbUserByClerkUserId({
        clerkUserId: userId,
        email,
        name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
      });
      if (!ensured) {
        return { sitterId: null, published: false, publishedAt: null, profile: null };
      }

      const user = await prisma.user.findUnique({ where: { id: ensured.id } });
      if (!user) {
        return { sitterId: null, published: false, publishedAt: null, profile: null };
      }

      const sitterProfile = await prisma.sitterProfile.findUnique({
        where: { userId: user.id },
        select: { sitterId: true, published: true, publishedAt: true },
      });

      // Authorization rule: allow /host ONLY if a SitterProfile exists for this DB user.
      if (!sitterProfile) {
        return { sitterId: null, published: false, publishedAt: null, profile: null };
      }

      const sitterId = typeof sitterProfile.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : null;

      if (!sitterId) {
        return { sitterId: null, published: false, publishedAt: null, profile: null };
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

      return {
        sitterId,
        published: Boolean(sitterProfile?.published),
        publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
        profile,
      };
    },
    ["hostUserData", primaryEmail],
    { revalidate: 30 }
  );

  return load(primaryEmail);
}
