import type { NextRequest } from "next/server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

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
    const updates: Record<string, unknown> = {};
    if (!byClerk.email || byClerk.email !== email) {
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
    console.info("[role-resolution][ensureDbUser] found by clerkUserId", {
      clerkUserId,
      dbUserId: result.id,
      role: result.role,
      sitterId: result.sitterId,
    });
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
      console.info("[role-resolution][ensureDbUser] migrated email→clerk link", {
        clerkUserId,
        dbUserId: result.id,
        role: result.role,
        sitterId: result.sitterId,
        email,
      });
      return result;
    } catch {
      const again = await (prisma as any).user.findUnique({ where: { clerkUserId }, select: { id: true, role: true, sitterId: true } });
      if (again?.id) {
        const result = { id: again.id, role: again.role, sitterId: again.sitterId ?? null, created: false };
        console.info("[role-resolution][ensureDbUser] race recovery", {
          clerkUserId,
          dbUserId: result.id,
          role: result.role,
        });
        return result;
      }
    }
  }

  // Guard: before creating a new OWNER user, double-check no existing user
  // has a SitterProfile for this email. This prevents accidental duplication.
  const existingByEmailFinal = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, sitterId: true } });
  if (existingByEmailFinal?.id) {
    console.warn("[role-resolution][ensureDbUser] DUPLICATE_PREVENTION: user already exists for email, linking clerkUserId", {
      clerkUserId,
      email,
      existingUserId: existingByEmailFinal.id,
      existingRole: existingByEmailFinal.role,
    });
    try {
      await (prisma as any).user.update({
        where: { id: existingByEmailFinal.id },
        data: { clerkUserId },
      });
    } catch {
      // unique constraint on clerkUserId — another user already linked
    }
    return { id: existingByEmailFinal.id, role: existingByEmailFinal.role, sitterId: existingByEmailFinal.sitterId ?? null, created: false };
  }

  const role = "OWNER";
  const sitterId = null;
  const created = await (prisma as any).user.create({
    data: { clerkUserId, email, name, role, sitterId },
    select: { id: true, role: true, sitterId: true },
  });
  const result = { id: created.id, role: created.role, sitterId: created.sitterId ?? null, created: true };
  console.info("[role-resolution][ensureDbUser] new user created", {
    clerkUserId,
    dbUserId: result.id,
    role: result.role,
    email,
  });
  return result;
}

export async function ensureDbUserFromClerkAuth(): Promise<(DbUserEnsured & { created: boolean }) | null> {
  const { userId } = await auth();
  if (!userId) return null;

  let email = "";
  let name: string | null = null;
  for (let i = 0; i < 6; i += 1) {
    const clerkUser = await currentUser();
    email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    name = typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null;
    if (email) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!email) return null;

  return ensureDbUserByClerkUserId({ clerkUserId: userId, email, name });
}

export async function resolveDbUserId(req: NextRequest) {
  void req;

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
