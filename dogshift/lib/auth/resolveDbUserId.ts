/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auth.js v5 — DB user resolution helpers.
 *
 * In the Clerk era this file bridged Clerk session → Prisma User by linking
 * via `clerkUserId`. With Auth.js v5 (database session strategy + PrismaAdapter)
 * the Auth.js session ALREADY carries the Prisma User.id directly — no bridge
 * needed at runtime.
 *
 * What we keep:
 *  - The exported function signatures (60+ callsites depend on them) so this
 *    PR only swaps the implementation, not every caller.
 *  - `ensureDbUserByClerkUserId` lives on as a legacy helper used by the
 *    one-shot scripts/migrate-clerk-users.ts to relink existing rows.
 *
 * What changes:
 *  - All runtime paths read from `auth()` (Auth.js) instead of Clerk's
 *    `auth()` + `currentUser()` + `clerkClient()`.
 *  - `ensureDbUserFromClerkAuth()` keeps its name (so callers don't break)
 *    but is now just a thin lookup against `session.user.id`. No creation
 *    needed — PrismaAdapter or `/api/auth/register` always create the row
 *    before a session exists.
 */
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

import { resolveEffectiveUserId } from "@/lib/auth/getAuthedDbUser";
import { prisma } from "@/lib/prisma";

export type DbUserEnsured = {
  id: string;
  role: Role;
  sitterId: string | null;
};

function normalizeEmail(email: string) {
  return email.replace(/\s+/g, "+").trim().toLowerCase();
}

/**
 * Look up (or create on the fly) a User by email. Used in places where we
 * only have the email — e.g. webhooks, contract signing, support tooling.
 *
 * No auth context required — caller is responsible for trusting the email
 * source.
 */
export async function ensureDbUserByEmail(params: { email: string; name?: string | null }): Promise<DbUserEnsured | null> {
  const email = normalizeEmail(params.email);
  if (!email) return null;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, sitterId: true },
  });
  if (existing?.id) {
    return { id: existing.id, role: existing.role, sitterId: existing.sitterId ?? null };
  }

  const name = typeof params.name === "string" && params.name.trim() ? params.name.trim() : null;
  const created = await prisma.user.create({
    data: { email, name, role: "OWNER", sitterId: null },
    select: { id: true, role: true, sitterId: true },
  });
  return { id: created.id, role: created.role, sitterId: created.sitterId ?? null };
}

/**
 * Legacy helper kept for one-off migration code (scripts/migrate-clerk-users.ts).
 *
 * Resolves a User by the historical `clerkUserId` column. Returns null if
 * no row has that clerkUserId (post-PR3 this will always be null since the
 * column gets dropped).
 *
 * @deprecated Use the Auth.js session directly: `session.user.id` is the
 *             Prisma User.id. This function only stays alive long enough to
 *             let the one-shot migration script relink rows.
 */
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

  // 1) Already linked?
  const byClerk = await (prisma as any).user.findUnique({
    where: { clerkUserId },
    select: { id: true, role: true, sitterId: true, email: true, name: true },
  });
  if (byClerk?.id) {
    const updates: Record<string, unknown> = {};
    if (!byClerk.email || byClerk.email !== email) updates.email = email;
    if (!byClerk.name && name) updates.name = name;
    if (Object.keys(updates).length > 0) {
      try {
        await (prisma as any).user.update({ where: { id: byClerk.id }, data: updates });
      } catch {
        /* swallow — non-critical metadata sync */
      }
    }
    return { id: byClerk.id, role: byClerk.role, sitterId: byClerk.sitterId ?? null, created: false };
  }

  // 2) User exists by email but never linked to Clerk → link in place.
  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, sitterId: true },
  });
  if (byEmail?.id) {
    try {
      const updated = await (prisma as any).user.update({
        where: { id: byEmail.id },
        data: { clerkUserId, ...(name ? { name } : null) },
        select: { id: true, role: true, sitterId: true },
      });
      return { id: updated.id, role: updated.role, sitterId: updated.sitterId ?? null, created: false };
    } catch {
      // Race: another request just linked the same clerkUserId. Re-read.
      const again = await (prisma as any).user.findUnique({
        where: { clerkUserId },
        select: { id: true, role: true, sitterId: true },
      });
      if (again?.id) {
        return { id: again.id, role: again.role, sitterId: again.sitterId ?? null, created: false };
      }
    }
  }

  // 3) Brand new — create a fresh OWNER row carrying the clerkUserId.
  const created = await (prisma as any).user.create({
    data: { clerkUserId, email, name, role: "OWNER", sitterId: null },
    select: { id: true, role: true, sitterId: true },
  });
  return { id: created.id, role: created.role, sitterId: created.sitterId ?? null, created: true };
}

/**
 * Returns the DB user for the current Auth.js session. Replaces the former
 * Clerk-driven version. Name kept for backwards compatibility with callers.
 *
 * Returns null when:
 *  - No active session
 *  - Session points at a User that no longer exists (race with deletion)
 */
export async function ensureDbUserFromClerkAuth(): Promise<(DbUserEnsured & { created: boolean }) | null> {
  // Impersonation-aware: when an admin is impersonating, this resolves to the
  // TARGET user id so /account + /host data loads as the target sees it.
  const userId = await resolveEffectiveUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, sitterId: true },
  });
  if (!user) return null;

  return { id: user.id, role: user.role, sitterId: user.sitterId ?? null, created: false };
}

/**
 * Returns the Prisma User.id of the current Auth.js session, or null if
 * unauthenticated. The `req` parameter is kept for API compatibility — Auth.js
 * v5's `auth()` reads cookies via async storage and does not need the request.
 */
export async function resolveDbUserId(req: NextRequest): Promise<string | null> {
  void req;
  // Impersonation-aware (target id when an admin is impersonating), with a
  // zero-extra-query fast path for normal users. See resolveEffectiveUserId.
  return resolveEffectiveUserId();
}
