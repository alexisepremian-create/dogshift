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
  const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
  const uid = tokenUserId(token);
  if (uid) return uid;

  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!email) return null;

  const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return dbUser?.id ?? null;
}
