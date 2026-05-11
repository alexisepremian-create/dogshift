/**
 * Auth.js v5 (NextAuth) — DogShift authentication configuration.
 *
 * Single source of truth for `auth()`, `handlers`, `signIn`, `signOut`.
 * Import everywhere via `@/auth`.
 *
 * Session strategy: "database" (not "jwt"). Reason: DogShift handles Stripe
 * Connect payouts — being able to revoke a session instantly (by deleting the
 * row in Session) is a security requirement. JWT sessions remain valid until
 * expiry even after the user is banned/refunded, which we cannot accept.
 *
 * trustHost: true — required behind Cloudflare proxy (otherwise Auth.js
 * rejects the host header).
 *
 * Coexists with Clerk during the migration window (PR 1). Clerk remains the
 * active auth provider until PR 2 swaps the login/signup forms.
 */
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

function normalizeEmail(email: string): string {
  return email.replace(/\s+/g, "+").trim().toLowerCase();
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
    error: "/login",
    // "verifyRequest" is the "go check your inbox" landing page (distinct from
    // the existing /verify-email route which actually consumes the token).
    verifyRequest: "/check-email",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: { params: { prompt: "consent select_account" } },
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(creds) {
        const email = normalizeEmail(String(creds?.email ?? ""));
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        if (!user.passwordHash) {
          // Account exists but no password (migrated from Clerk, or Google-only).
          // Throwing here lets the UI display a precise message and direct the
          // user to /forgot-password instead of saying "wrong password".
          throw new Error("MIGRATED_NO_PASSWORD");
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // PrismaAdapter passes the full DB user via `user` in database-session mode.
      if (session.user) {
        session.user.id = user.id;
        (session.user as { role?: string }).role = (user as { role?: string }).role ?? "OWNER";
      }
      return session;
    },
    async signIn() {
      // Default role (OWNER) is enforced at the DB level via @default(OWNER).
      // No auto-promotion by email — role changes go through /api/role/* endpoints.
      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const u = new URL(url);
        if (u.origin === new URL(baseUrl).origin) return url;
      } catch {
        // ignore invalid URLs and fall through to baseUrl
      }
      return baseUrl;
    },
  },
});
