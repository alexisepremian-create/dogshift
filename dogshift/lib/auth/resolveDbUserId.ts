import type { NextRequest } from "next/server";

import { getToken } from "next-auth/jwt";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

type RoleJwt = { uid?: string; sub?: string };

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

export async function resolveDbUserId(req: NextRequest) {
  if (process.env.NEXTAUTH_SECRET) {
    try {
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
      const uid = tokenUserId(token);
      if (uid) return uid;
    } catch {
      // ignore and fallback to Clerk
    }
  }

  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!email) return null;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing?.id) return existing.id;

  const created = await prisma.user.create({
    data: {
      email,
      name: typeof clerkUser?.fullName === "string" && clerkUser.fullName.trim() ? clerkUser.fullName.trim() : null,
      role: "OWNER",
    },
    select: { id: true },
  });
  return created.id;
}
