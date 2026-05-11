/**
 * One-stop helper for server-side route handlers that need the authenticated
 * DB User in full. Replaces the Clerk-era trio
 *   `await auth()` + `await currentUser()` + `ensureDbUserByClerkUserId(...)`
 * with a single call that returns null when unauthenticated.
 *
 * Returns the same Prisma-ish shape every caller wants:
 *   { id, email, name, role, sitterId }
 *
 * Callers should default to:
 *   const user = await getAuthedDbUser();
 *   if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
 */
import type { Role } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AuthedDbUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  sitterId: string | null;
};

export async function getAuthedDbUser(): Promise<AuthedDbUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, sitterId: true },
  });
  if (!u) return null;

  return {
    id: u.id,
    email: u.email ?? "",
    name: u.name ?? null,
    role: u.role,
    sitterId: u.sitterId ?? null,
  };
}
