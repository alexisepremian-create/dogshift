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

function parseEmailList(value: string | undefined, fallback: string[]) {
  if (!value) return fallback.map(normalizeEmail);
  return value
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter(Boolean);
}

const OWNER_EMAILS = parseEmailList(process.env.OWNER_EMAILS, ["luigi111.ytbr@gmail.com"]);
const SITTER_EMAILS = parseEmailList(process.env.SITTER_EMAILS, ["alexis.epremian@gmail.com"]);

function wantedRoleForEmail(emailRaw: string | null | undefined) {
  const email = typeof emailRaw === "string" ? normalizeEmail(emailRaw) : "";
  if (!email) return null;
  if (email === "luigi111.ytbr@gmail.com") return "OWNER";
  if (email === "alexis.epremian@gmail.com") return "SITTER";
  if (OWNER_EMAILS.includes(email)) return "OWNER";
  if (SITTER_EMAILS.includes(email)) return "SITTER";
  return null;
}

function newSitterId() {
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function ensureDbUserByEmail(params: { email: string; name?: string | null }): Promise<DbUserEnsured | null> {
  const email = normalizeEmail(params.email);
  if (!email) return null;

  const roleWanted = wantedRoleForEmail(email);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, sitterId: true } });
  if (existing?.id) {
    if (roleWanted && existing.role !== roleWanted) {
      if (roleWanted === "SITTER") {
        const sitterId = existing.sitterId && existing.sitterId.trim() ? existing.sitterId.trim() : newSitterId();
        const updated = await prisma.user.update({ where: { id: existing.id }, data: { role: "SITTER", sitterId }, select: { id: true, role: true, sitterId: true } });
        return { id: updated.id, role: updated.role, sitterId: updated.sitterId ?? null };
      }

      const updated = await prisma.user.update({ where: { id: existing.id }, data: { role: "OWNER" }, select: { id: true, role: true, sitterId: true } });
      return { id: updated.id, role: updated.role, sitterId: updated.sitterId ?? null };
    }

    return { id: existing.id, role: existing.role, sitterId: existing.sitterId ?? null };
  }

  const name = typeof params.name === "string" && params.name.trim() ? params.name.trim() : null;
  const role = roleWanted ?? "OWNER";
  const sitterId = role === "SITTER" ? newSitterId() : null;
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
