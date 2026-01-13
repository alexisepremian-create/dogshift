import type { NextRequest } from "next/server";

import { getToken } from "next-auth/jwt";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

type RoleJwt = { uid?: string; sub?: string };

export type DbUserEnsured = {
  id: string;
  role: "OWNER" | "SITTER";
  sitterId: string | null;
};

function normalizeEmail(email: string) {
  return email.replace(/\s+/g, "+").trim().toLowerCase();
}

export async function ensureDbUserByEmail(params: { email: string; name?: string | null }): Promise<DbUserEnsured | null> {
  const email = normalizeEmail(params.email);
  if (!email) return null;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, sitterId: true } });
  if (existing?.id) {
    return { id: existing.id, role: existing.role, sitterId: existing.sitterId ?? null };
  }

  const name = typeof params.name === "string" && params.name.trim() ? params.name.trim() : null;
  const role = "OWNER";
  const sitterId = null;
  const created = await prisma.user.create({ data: { email, name, role, sitterId }, select: { id: true, role: true, sitterId: true } });
  return { id: created.id, role: created.role, sitterId: created.sitterId ?? null };
}

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

  const ensured = await ensureDbUserByEmail({
    email,
    name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
  });
  return ensured?.id ?? null;
}
