/**
 * Returns the full user context (DB user, sitter status, owner status) for the
 * currently authenticated Auth.js session.
 *
 * Public shape kept identical to the Clerk era — every caller that destructures
 * `{ userId, primaryEmail, dbUserId, hasSitterProfile, ... }` continues to work
 * without touching the callsite. Internally, all reads now come from the
 * Auth.js session + the Prisma User row (which IS the source of truth for
 * email and identity in PR 2+).
 *
 * `userId` historically meant the Clerk userId. To preserve the field name
 * without semantic confusion, we now populate it with the Prisma User.id (same
 * as `dbUserId`). All known callers treat it as "an opaque current user
 * identifier" and pass it to DB queries — so this swap is safe.
 */
import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSitterLifecycleStatus, type SitterLifecycleStatus } from "@/lib/sitterContract";

export type UserContexts = {
  userId: string;
  primaryEmail: string;
  dbUserId: string;
  hasSitterProfile: boolean;
  sitterLifecycleStatus: SitterLifecycleStatus | null;
  hasOwnerContext: boolean;
};

// Wrapped in React `cache()` so multiple callers in the same request (e.g. the
// /account layout AND the /account page) share ONE set of DB queries instead of
// re-running auth() + 4 reads each. `noStore()` keeps the route dynamic
// (per-request); cache() only dedupes within that request.
export const getUserContexts = cache(async function getUserContexts(): Promise<UserContexts> {
  noStore();

  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) {
    throw new Error("UNAUTHENTICATED");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, role: true, email: true, sitterId: true },
  });
  if (!dbUser) {
    throw new Error("DB_USER_UNAVAILABLE");
  }
  if (!dbUser.email) {
    throw new Error("MISSING_PRIMARY_EMAIL");
  }

  const [sitterProfile, ownerBooking, ownerConversation] = await Promise.all([
    prisma.sitterProfile.findUnique({
      where: { userId: dbUser.id },
      select: { id: true, lifecycleStatus: true, published: true },
    }),
    prisma.booking.findFirst({ where: { userId: dbUser.id }, select: { id: true } }),
    prisma.conversation.findFirst({ where: { ownerId: dbUser.id }, select: { id: true } }),
  ]);

  const normalizedStatus = sitterProfile
    ? normalizeSitterLifecycleStatus(sitterProfile.lifecycleStatus, sitterProfile.published)
    : null;

  console.info("[role-resolution][getUserContexts]", {
    dbUserId: dbUser.id,
    email: dbUser.email,
    dbRole: dbUser.role,
    hasSitterProfile: Boolean(sitterProfile),
    rawLifecycleStatus: sitterProfile?.lifecycleStatus ?? null,
    published: sitterProfile?.published ?? null,
    normalizedLifecycleStatus: normalizedStatus,
    hasOwnerContext: Boolean(ownerBooking || ownerConversation),
  });

  return {
    userId: dbUser.id,
    primaryEmail: dbUser.email,
    dbUserId: dbUser.id,
    hasSitterProfile: Boolean(sitterProfile),
    sitterLifecycleStatus: normalizedStatus,
    hasOwnerContext: Boolean(ownerBooking || ownerConversation),
  };
});
