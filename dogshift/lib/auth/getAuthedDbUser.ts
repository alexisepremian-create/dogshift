/**
 * One-stop helper for server-side route handlers that need the authenticated
 * DB User in full. Replaces the Clerk-era trio
 *   `await auth()` + `await currentUser()` + `ensureDbUserByClerkUserId(...)`
 * with a single call that returns null when unauthenticated.
 *
 * Returns the same Prisma-ish shape every caller wants:
 *   { id, email, name, role, sitterId, impersonatedBy }
 *
 * `impersonatedBy` is non-null when an authenticated ADMIN has started an
 * impersonation session via /api/admin/impersonate/start and the signed
 * cookie is still valid. In that case the returned id/email/name/role/sitterId
 * are the TARGET user's, so every existing call site sees the platform exactly
 * as the target sees it — without any per-call-site refactor.
 *
 * Callers should default to:
 *   const user = await getAuthedDbUser();
 *   if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
 */
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/adminAuth";
import {
  IMPERSONATION_COOKIE,
  getImpersonationSecret,
  verifyImpersonationToken,
} from "@/lib/auth/impersonation";
import { prisma } from "@/lib/prisma";

export type AuthedDbUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  sitterId: string | null;
  impersonatedBy: { adminId: string; adminEmail: string } | null;
};

export async function getAuthedDbUser(): Promise<AuthedDbUser | null> {
  const session = await auth();
  const realId = session?.user?.id;
  if (!realId) return null;

  // Load the real (signed-in) user first — we always need them to confirm
  // admin status before honouring an impersonation cookie. Without this,
  // a stolen cookie alone could grant impersonation; gating on the live
  // session role makes that worthless.
  const realUser = await prisma.user.findUnique({
    where: { id: realId },
    select: { id: true, email: true, name: true, role: true, sitterId: true },
  });
  if (!realUser) return null;

  const impersonation = await readImpersonationIfAdmin(realUser);
  if (impersonation) return impersonation;

  return {
    id: realUser.id,
    email: realUser.email ?? "",
    name: realUser.name ?? null,
    role: realUser.role,
    sitterId: realUser.sitterId ?? null,
    impersonatedBy: null,
  };
}

async function readImpersonationIfAdmin(realUser: {
  id: string;
  email: string | null;
  role: Role;
}): Promise<AuthedDbUser | null> {
  // Hard gate: only verified admins can have an impersonation cookie honored.
  // Layered with the Auth.js role + ADMIN_EMAILS whitelist for belt+suspenders.
  if (realUser.role !== "ADMIN") return null;
  if (!realUser.email || !isAdminEmail(realUser.email)) return null;

  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;

  const payload = await verifyImpersonationToken(raw, getImpersonationSecret());
  if (!payload) return null;

  // Defense in depth: the payload also pins adminId — refuse if it doesn't
  // match the current session, so a cookie issued for admin A cannot be
  // replayed by admin B.
  if (payload.adminId !== realUser.id) return null;

  // Fetch the target user fresh from DB — never trust the role baked in the
  // payload; the target could have been promoted to ADMIN since the cookie
  // was minted, in which case we refuse to impersonate them (matches the
  // /start endpoint's contract).
  const target = await prisma.user.findUnique({
    where: { id: payload.targetUserId },
    select: { id: true, email: true, name: true, role: true, sitterId: true },
  });
  if (!target) return null;
  if (target.role === "ADMIN") return null;

  return {
    id: target.id,
    email: target.email ?? "",
    name: target.name ?? null,
    role: target.role,
    sitterId: target.sitterId ?? null,
    impersonatedBy: { adminId: realUser.id, adminEmail: realUser.email },
  };
}

/**
 * Cheap "who is this request acting as" resolver for hot paths that only need
 * the effective user id (not the whole row). This is the impersonation-aware
 * replacement for `session.user.id` — every generic identity resolver
 * (`resolveDbUserId`, `getUserContexts`, `requireSitterOwner`, …) must go
 * through this so an admin's impersonation cookie is honored everywhere, not
 * only in the handful of call sites that use `getAuthedDbUser()` directly.
 *
 * Fast path: when there is NO impersonation cookie (the 99% case), this does a
 * single `auth()` read and ZERO extra DB queries — identical cost to the old
 * `await auth()` path, so no Neon/compute regression for normal users. The
 * heavier admin-gated resolution (via `getAuthedDbUser`) only runs when the
 * cookie is actually present.
 */
export async function resolveEffectiveUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  if (cookieStore.get(IMPERSONATION_COOKIE)?.value) {
    // Cookie present → fully resolve (admin gate + target lookup + expiry).
    const authed = await getAuthedDbUser();
    return authed?.id ?? null;
  }
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Convenience variant for callers that explicitly want the real signed-in
 * user, bypassing impersonation. Used by `/api/admin/impersonate/stop` and
 * the audit log writer — places where "who's actually clicking the button"
 * matters more than "who is the request acting as".
 */
export async function getRealAuthedDbUser(): Promise<AuthedDbUser | null> {
  const session = await auth();
  const realId = session?.user?.id;
  if (!realId) return null;

  const u = await prisma.user.findUnique({
    where: { id: realId },
    select: { id: true, email: true, name: true, role: true, sitterId: true },
  });
  if (!u) return null;

  return {
    id: u.id,
    email: u.email ?? "",
    name: u.name ?? null,
    role: u.role,
    sitterId: u.sitterId ?? null,
    impersonatedBy: null,
  };
}
