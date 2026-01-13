import type { NextRequest } from "next/server";

import { getToken } from "next-auth/jwt";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

type RoleJwt = { uid?: string; sub?: string };

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
  if (OWNER_EMAILS.includes(email)) return "OWNER";
  if (SITTER_EMAILS.includes(email)) return "SITTER";
  return null;
}

function newSitterId() {
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  const roleWanted = wantedRoleForEmail(email);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, sitterId: true } });
  if (existing?.id) {
    if (roleWanted && existing.role !== roleWanted) {
      if (roleWanted === "SITTER") {
        const sitterId = existing.sitterId && existing.sitterId.trim() ? existing.sitterId.trim() : newSitterId();
        await prisma.user.update({ where: { id: existing.id }, data: { role: "SITTER", sitterId } });
      } else {
        await prisma.user.update({ where: { id: existing.id }, data: { role: "OWNER" } });
      }
    }
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email,
      name: typeof clerkUser?.fullName === "string" && clerkUser.fullName.trim() ? clerkUser.fullName.trim() : null,
      role: roleWanted ?? "OWNER",
      sitterId: roleWanted === "SITTER" ? newSitterId() : null,
    },
    select: { id: true },
  });
  return created.id;
}
