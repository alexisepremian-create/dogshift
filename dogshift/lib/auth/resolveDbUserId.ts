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

export async function ensureDbUserByClerkUserId(params: {
  clerkUserId: string;
  email: string;
  name?: string | null;
}): Promise<(DbUserEnsured & { created: boolean }) | null> {
  const clerkUserId = typeof params.clerkUserId === "string" ? params.clerkUserId.trim() : "";
  if (!clerkUserId) return null;

  const email = normalizeEmail(params.email);
  if (!email) return null;

  const name = typeof params.name === "string" && params.name.trim() ? params.name.trim() : null;

  const byClerk = await (prisma as any).user.findUnique({
    where: { clerkUserId },
    select: { id: true, role: true, sitterId: true, email: true, name: true },
  });
  if (byClerk?.id) {
    // Avoid destructive overwrites: only fill missing pieces.
    const updates: Record<string, unknown> = {};
    if (!byClerk.email || byClerk.email !== email) {
      // Keep email in sync when it changes.
      updates.email = email;
    }
    if (!byClerk.name && name) {
      updates.name = name;
    }
    if (Object.keys(updates).length > 0) {
      try {
        await (prisma as any).user.update({ where: { id: byClerk.id }, data: updates });
      } catch {
        // ignore
      }
    }
    const result = { id: byClerk.id, role: byClerk.role, sitterId: byClerk.sitterId ?? null, created: false };
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth][ensureDbUserByClerkUserId]", { clerkUserId, dbUserId: result.id, created: result.created });
    }
    return result;
  }

  // Migration path: existing users created by email before clerkUserId existed.
  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, sitterId: true } });
  if (byEmail?.id) {
    try {
      const updated = await (prisma as any).user.update({
        where: { id: byEmail.id },
        data: { clerkUserId, ...(name ? { name } : null) },
        select: { id: true, role: true, sitterId: true },
      });
      const result = { id: updated.id, role: updated.role, sitterId: updated.sitterId ?? null, created: false };
      if (process.env.NODE_ENV !== "production") {
        console.log("[auth][ensureDbUserByClerkUserId]", { clerkUserId, dbUserId: result.id, created: result.created, migratedFromEmail: true });
      }
      return result;
    } catch {
      // If race/unique constraint occurs, fall back to re-fetch.
      const again = await (prisma as any).user.findUnique({ where: { clerkUserId }, select: { id: true, role: true, sitterId: true } });
      if (again?.id) {
        const result = { id: again.id, role: again.role, sitterId: again.sitterId ?? null, created: false };
        if (process.env.NODE_ENV !== "production") {
          console.log("[auth][ensureDbUserByClerkUserId]", { clerkUserId, dbUserId: result.id, created: result.created, refetchAfterRace: true });
        }
        return result;
      }
    }
  }

  const role = "OWNER";
  const sitterId = null;
  const created = await (prisma as any).user.create({
    data: { clerkUserId, email, name, role, sitterId },
    select: { id: true, role: true, sitterId: true },
  });
  const result = { id: created.id, role: created.role, sitterId: created.sitterId ?? null, created: true };
  if (process.env.NODE_ENV !== "production") {
    console.log("[auth][ensureDbUserByClerkUserId]", { clerkUserId, dbUserId: result.id, created: result.created });
  }
  return result;
}

export async function ensureDbUserFromClerkAuth(): Promise<(DbUserEnsured & { created: boolean }) | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!email) return null;

  const name = typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null;

  return ensureDbUserByClerkUserId({ clerkUserId: userId, email, name });
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

  const ensured = await ensureDbUserByClerkUserId({
    clerkUserId: userId,
    email,
    name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[auth][resolveDbUserId] ensure", {
      clerkUserId: userId,
      dbUserId: ensured?.id ?? null,
      created: ensured?.created ?? null,
    });
  }

  return ensured?.id ?? null;
}
