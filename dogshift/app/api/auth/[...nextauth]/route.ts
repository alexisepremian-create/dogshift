import NextAuth, { type NextAuthOptions, type Session, type User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RoleJwt = { role?: string; uid?: string; sitterId?: string };

const envLogGoogleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
console.log("[next-auth][env]", {
  NEXTAUTH_URL: (process.env.NEXTAUTH_URL || "").trim() || null,
  NEXTAUTH_SECRET: (process.env.NEXTAUTH_SECRET || "").trim() ? "present" : "missing",
  GOOGLE_CLIENT_ID: envLogGoogleClientId ? `${envLogGoogleClientId.slice(0, 6)}…` : "missing",
  DATABASE_URL: process.env.DATABASE_URL ? "present" : "missing",
});

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

async function applyWantedRoleByEmail(emailRaw: string | null | undefined) {
  const email = typeof emailRaw === "string" ? normalizeEmail(emailRaw) : "";
  if (!email) return;

  const roleWanted = wantedRoleForEmail(email);
  if (!roleWanted) return;

  if (roleWanted === "SITTER") {
    const existing = await prisma.user.findUnique({ where: { email } });
    const existingSitterId = (existing as unknown as { sitterId?: string | null } | null)?.sitterId ?? null;
    const sitterId = existingSitterId && existingSitterId.trim()
      ? existingSitterId.trim()
      : `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await prisma.user.updateMany({
      where: { email },
      data: { role: "SITTER", sitterId } as unknown as { role: "SITTER"; sitterId: string },
    });
    return;
  }

  await prisma.user.updateMany({
    where: { email },
    data: { role: "OWNER" } as unknown as { role: "OWNER" },
  });
}

function missingAuthEnv() {
  const missing: string[] = [];
  if (!process.env.NEXTAUTH_SECRET) missing.push("NEXTAUTH_SECRET");
  if (!process.env.NEXTAUTH_URL) missing.push("NEXTAUTH_URL");
  if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  return missing;
}

export const authOptions: NextAuthOptions = {
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  logger: {
    error(code: string, metadata?: unknown) {
      console.error("[next-auth][error]", code, metadata);
    },
    warn(code: string) {
      console.warn("[next-auth][warn]", code);
    },
    debug(code: string, metadata?: unknown) {
      console.log("[next-auth][debug]", code, metadata);
    },
  },
  providers: [
    GoogleProvider({
      clientId: (process.env.GOOGLE_CLIENT_ID ?? "") as string,
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET ?? "") as string,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "consent select_account",
        },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email = normalizeEmail(credentials?.email ?? "");
          const password = credentials?.password ?? "";

          if (!email || !password) {
            console.warn("[next-auth][credentials] missing email/password");
            return null;
          }

          const dbUser = await prisma.user.findUnique({ where: { email } });
          if (!dbUser) {
            console.warn("[next-auth][credentials] user not found", email);
            return null;
          }

          const passwordHash = (dbUser as unknown as { passwordHash?: string | null }).passwordHash;
          if (!passwordHash) {
            console.warn("[next-auth][credentials] google-only account (no passwordHash)", email);
            throw new Error("GOOGLE_ONLY");
          }

          const bcryptjs = await import("bcryptjs");
          const ok = await bcryptjs.compare(password, passwordHash);
          if (!ok) {
            console.warn("[next-auth][credentials] password mismatch", email);
            return null;
          }

          console.log("[next-auth][credentials] success", email);
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
          } as User;
        } catch (err) {
          if (err instanceof Error && err.message === "GOOGLE_ONLY") {
            throw err;
          }
          console.error("[next-auth][credentials] authorize error", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user?.email) {
        token.email = user.email;
      }

      if (typeof user?.name === "string") {
        token.name = user.name;
      }

      if (token?.email) {
        const email = normalizeEmail(String(token.email));
        const dbUser = await prisma.user.findUnique({ where: { email } });
        if (dbUser) {
          const sitterId = (dbUser as unknown as { sitterId?: string }).sitterId;
          (token as unknown as RoleJwt).role = String((dbUser as { role: unknown }).role);
          (token as unknown as RoleJwt).uid = String((dbUser as { id: unknown }).id);
          (token as unknown as RoleJwt).sitterId = typeof sitterId === "string" ? sitterId : undefined;

          const name = (dbUser as unknown as { name?: string | null }).name;
          if (typeof name === "string") {
            token.name = name;
          }
        } else {
          (token as unknown as RoleJwt).role = wantedRoleForEmail(email) ?? "OWNER";
        }
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as unknown as { role?: unknown }).role = (token as unknown as RoleJwt).role ?? "OWNER";
        (session.user as unknown as { id?: unknown }).id = (token as unknown as RoleJwt).uid;
        (session.user as unknown as { sitterId?: unknown }).sitterId = (token as unknown as RoleJwt).sitterId;

        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
      }
      return session;
    },
    async signIn({ user }: { user: User }) {
      if (!user.email) return false;
      await applyWantedRoleByEmail(user.email);
      return true;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch {
        // ignore
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async createUser({ user }: { user: User }) {
      await applyWantedRoleByEmail(user.email);
    },
  },
};

const handler = missingAuthEnv().length === 0 ? NextAuth(authOptions) : null;

function misconfiguredResponse() {
  const missing = missingAuthEnv();
  console.error("[next-auth] misconfigured env", { missing });
  return NextResponse.json({ ok: false, error: "NEXTAUTH_MISCONFIGURED", missing }, { status: 500 });
}

export async function GET(req: NextRequest) {
  if (!handler) return misconfiguredResponse();
  return handler(req);
}

export async function POST(req: NextRequest) {
  if (!handler) return misconfiguredResponse();
  return handler(req);
}
