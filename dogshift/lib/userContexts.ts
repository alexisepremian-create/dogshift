import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { normalizeSitterLifecycleStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";

export type UserContexts = {
  userId: string;
  primaryEmail: string;
  dbUserId: string;
  hasSitterProfile: boolean;
  sitterLifecycleStatus: SitterLifecycleStatus | null;
  hasOwnerContext: boolean;
};

export async function getUserContexts(): Promise<UserContexts> {
  noStore();
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const client = await clerkClient();
  const clerkUser = (await currentUser()) ?? (await client.users.getUser(userId));
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) {
    throw new Error("MISSING_PRIMARY_EMAIL");
  }

  const rawName = typeof clerkUser?.fullName === "string" ? clerkUser.fullName : "";

  const ensured = await ensureDbUserByClerkUserId({ clerkUserId: userId, email: primaryEmail, name: rawName || null });
  if (!ensured) {
    throw new Error("DB_USER_UNAVAILABLE");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: ensured.id }, select: { id: true, role: true, email: true, sitterId: true } });
  if (!dbUser) {
    throw new Error("DB_USER_UNAVAILABLE");
  }

  const [sitterProfile, ownerBooking, ownerConversation] = await Promise.all([
    prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { id: true, lifecycleStatus: true, published: true } }),
    prisma.booking.findFirst({ where: { userId: dbUser.id }, select: { id: true } }),
    prisma.conversation.findFirst({ where: { ownerId: dbUser.id }, select: { id: true } }),
  ]);

  const normalizedStatus = sitterProfile
    ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published)
    : null;

  console.info("[role-resolution][getUserContexts]", {
    clerkUserId: userId,
    dbUserId: dbUser.id,
    email: primaryEmail,
    dbRole: (dbUser as any).role ?? null,
    hasSitterProfile: Boolean(sitterProfile),
    rawLifecycleStatus: sitterProfile?.lifecycleStatus ?? null,
    published: sitterProfile?.published ?? null,
    normalizedLifecycleStatus: normalizedStatus,
    hasOwnerContext: Boolean(ownerBooking || ownerConversation),
  });

  return {
    userId,
    primaryEmail,
    dbUserId: dbUser.id,
    hasSitterProfile: Boolean(sitterProfile),
    sitterLifecycleStatus: normalizedStatus,
    hasOwnerContext: Boolean(ownerBooking || ownerConversation),
  };
}
