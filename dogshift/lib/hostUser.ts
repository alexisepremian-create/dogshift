import { auth, currentUser } from "@clerk/nextjs/server";
import { unstable_cache as cache } from "next/cache";

import { prisma } from "@/lib/prisma";

export type HostUserData = {
  sitterId: string | null;
  published: boolean;
  publishedAt: string | null;
  profile: unknown;
};

function generateSitterId() {
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
      const dbUser =
        (await prisma.user.findUnique({ where: { email } })) ??
        (await prisma.user.create({
          data: {
            email,
            name: typeof clerkUser?.fullName === "string" && clerkUser.fullName.trim() ? clerkUser.fullName.trim() : null,
            role: "SITTER",
          },
        }));

      const user = await prisma.user.findUnique({ where: { id: dbUser.id } });
      if (!user) {
        return { sitterId: null, published: false, publishedAt: null, profile: null };
      }

      let sitterId = (user as unknown as { sitterId?: string | null }).sitterId ?? null;
      if (!sitterId) {
        sitterId = generateSitterId();
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { sitterId } as unknown as Record<string, unknown>,
          });
        } catch {
          const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
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

      const sitterProfileDelegate = (prisma as any)?.sitterProfile as
        | {
            upsert: (args: any) => Promise<{ published: boolean; publishedAt: Date | null }>;
          }
        | undefined;

      const sitterProfile = sitterProfileDelegate
        ? await sitterProfileDelegate.upsert({
            where: { userId: user.id },
            create: { userId: user.id, sitterId, published: false, publishedAt: null },
            update: { sitterId },
            select: { published: true, publishedAt: true },
          })
        : null;

      return {
        sitterId,
        published: Boolean(sitterProfile?.published),
        publishedAt: sitterProfile?.publishedAt instanceof Date ? sitterProfile.publishedAt.toISOString() : null,
        profile,
      };
    },
    ["hostUserData"],
    { revalidate: 30 }
  );

  return load(primaryEmail);
}
