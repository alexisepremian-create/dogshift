import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { unstable_noStore as noStore } from "next/cache";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByEmail } from "@/lib/auth/resolveDbUserId";

export type UserContexts = {
  userId: string;
  primaryEmail: string;
  dbUserId: string;
  hasSitterProfile: boolean;
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

  const ensured = await ensureDbUserByEmail({ email: primaryEmail, name: rawName || null });
  if (!ensured) {
    throw new Error("DB_USER_UNAVAILABLE");
  }

  const dbUser = await prisma.user.findUnique({ where: { id: ensured.id } });
  if (!dbUser) {
    throw new Error("DB_USER_UNAVAILABLE");
  }

  const [sitterProfile, ownerBooking, ownerConversation] = await Promise.all([
    prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { id: true } }),
    prisma.booking.findFirst({ where: { userId: dbUser.id }, select: { id: true } }),
    prisma.conversation.findFirst({ where: { ownerId: dbUser.id }, select: { id: true } }),
  ]);

  return {
    userId,
    primaryEmail,
    dbUserId: dbUser.id,
    hasSitterProfile: Boolean(sitterProfile),
    hasOwnerContext: Boolean(ownerBooking || ownerConversation),
  };
}
