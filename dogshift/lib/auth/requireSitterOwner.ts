import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export type RequireSitterOwnerResult =
  | { ok: true; dbUserId: string; sitterId: string }
  | { ok: false; status: 401 | 403; error: "UNAUTHORIZED" | "FORBIDDEN" };

export async function requireSitterOwner(_req: NextRequest): Promise<RequireSitterOwnerResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const ensured = await ensureDbUserByClerkUserId({
    clerkUserId: userId,
    email: primaryEmail,
    name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
  });
  if (!ensured?.id) return { ok: false, status: 401, error: "UNAUTHORIZED" };

  const sitterProfile = await prisma.sitterProfile.findUnique({
    where: { userId: ensured.id },
    select: { sitterId: true },
  });
  const sitterId = typeof sitterProfile?.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : "";
  if (!sitterId) return { ok: false, status: 403, error: "FORBIDDEN" };

  return { ok: true, dbUserId: ensured.id, sitterId };
}
