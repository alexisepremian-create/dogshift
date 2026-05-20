/**
 * Auth.js v5 (NextAuth) — DogShift authentication configuration.
 *
 * Single source of truth for `auth()`, `handlers`, `signIn`, `signOut`.
 * Import everywhere via `@/auth`.
 *
 * Session strategy: "jwt".
 *
 * Why JWT and not database? The Credentials provider in Auth.js v5
 * REQUIRES jwt strategy — credentials-authorized users are never written
 * to the Session table by the adapter. With strategy: "database",
 * `auth()` returns null right after a successful credentials signIn,
 * which broke /post-login (it bounced users back to /login?force=1).
 *
 * Trade-off vs "database":
 *   - We lose instant revocation. A JWT remains valid until expiry
 *     (30 days by default) even if the user is deleted or the password
 *     rotated. This is acceptable because:
 *       a) The JWT callback below reads the User row from DB on every
 *          request, so we can detect deletion and force a re-login.
 *       b) Stripe payouts go through Stripe Connect which has its own
 *          revocation knobs independent of our session.
 *
 * trustHost: true — required behind Cloudflare proxy (otherwise Auth.js
 * rejects the host header).
 */
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

function normalizeEmail(email: string): string {
  return email.replace(/\s+/g, "+").trim().toLowerCase();
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
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
    // Apple Sign-In is MANDATORY on iOS App Store as soon as another third-party
    // OAuth provider (Google here) is offered. See native-app.md for the Apple
    // Developer setup (Service ID, Key ID, Team ID, private key .p8 file).
    // Falls back to no-op when env vars are missing (e.g. dev without Apple setup).
    ...(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET
      ? [
          Apple({
            clientId: process.env.AUTH_APPLE_ID,
            clientSecret: process.env.AUTH_APPLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
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
    /**
     * JWT callback runs on:
     *   - Sign in (`user` is populated by the provider)
     *   - Every subsequent request (only `token` is populated)
     *
     * We persist `id` and `role` in the token so /api/auth/session and
     * server-side `auth()` can return them without an extra DB hit.
     *
     * On every request we ALSO re-read User.role from the DB so that an
     * admin promotion or demotion is reflected immediately (no stale
     * 30-day cached role). The lookup is keyed by token.sub which is the
     * Prisma User.id we set at sign-in time.
     */
    async jwt({ token, user }) {
      // First call after sign-in: copy the DB id onto the token.
      if (user?.id) {
        token.sub = user.id;
      }

      // Every call: re-read the role from DB so promotions take effect
      // without forcing a sign-out.
      const userId = typeof token.sub === "string" ? token.sub : null;
      if (userId) {
        const dbUser = await prisma.user
          .findUnique({ where: { id: userId }, select: { id: true, role: true } })
          .catch(() => null);
        if (!dbUser) {
          // User row vanished (account deletion). Force re-login by
          // returning a token with no sub — session callback will null
          // out the user.
          return {};
        }
        (token as { role?: string }).role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.sub === "string") {
        session.user.id = token.sub;
        (session.user as { role?: string }).role =
          (token as { role?: string }).role ?? "OWNER";
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
