import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

export type UserContexts = {
  userId: string;
  primaryEmail: string;
  dbUserId: string;
  hasSitterProfile: boolean;
  hasOwnerContext: boolean;
};

export async function getUserContexts(): Promise<UserContexts> {
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

  const dbUser =
    (await prisma.user.findUnique({ where: { email: primaryEmail } })) ??
    (await prisma.user.create({
      data: {
        email: primaryEmail,
        name: rawName || null,
        role: "OWNER",
      },
    }));

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
