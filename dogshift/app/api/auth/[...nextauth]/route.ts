import NextAuth, { type NextAuthOptions, type Session, type User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { JWT } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RoleJwt = { role?: string; uid?: string; sitterId?: string };

const minimalOauth = (process.env.NEXTAUTH_MINIMAL_OAUTH || "").trim() === "1";

const envLogGoogleClientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
console.log("[next-auth][env]", {
  NEXTAUTH_URL: (process.env.NEXTAUTH_URL || "").trim() || null,
  NEXTAUTH_SECRET: (process.env.NEXTAUTH_SECRET || "").trim() ? "present" : "missing",
  GOOGLE_CLIENT_ID: envLogGoogleClientId ? `${envLogGoogleClientId.slice(0, 6)}…` : "missing",
  DATABASE_URL: process.env.DATABASE_URL ? "present" : "missing",
  NEXTAUTH_MINIMAL_OAUTH: minimalOauth,
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

const missingEnvAtBoot = missingAuthEnv();
if (missingEnvAtBoot.length > 0) {
  console.error("[next-auth] misconfigured env", { missing: missingEnvAtBoot });
  throw new Error("NEXTAUTH_MISCONFIGURED");
}

export const authOptions: NextAuthOptions = {
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  cookies:
    process.env.NODE_ENV === "production"
      ? {
          sessionToken: {
            name: "__Secure-next-auth.session-token",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
          csrfToken: {
            name: "__Host-next-auth.csrf-token",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
          callbackUrl: {
            name: "__Secure-next-auth.callback-url",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
          pkceCodeVerifier: {
            name: "__Secure-next-auth.pkce.code_verifier",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
          state: {
            name: "__Secure-next-auth.state",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
          nonce: {
            name: "__Secure-next-auth.nonce",
            options: {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
              secure: true,
            },
          },
        }
      : undefined,
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
      try {
        if (user?.email) {
          token.email = user.email;
        }

        if (typeof user?.name === "string") {
          token.name = user.name;
        }

        if (token?.email && !minimalOauth) {
          const email = normalizeEmail(String(token.email));
          try {
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
          } catch (err) {
            console.error("[next-auth][jwt] db lookup failed", {
              email,
              err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
            });
          }
        }

        return token;
      } catch (err) {
        console.error("[next-auth][jwt] callback failed", {
          err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
        });
        return token;
      }
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      try {
        if (session.user && !minimalOauth) {
          (session.user as unknown as { role?: unknown }).role = (token as unknown as RoleJwt).role ?? "OWNER";
          (session.user as unknown as { id?: unknown }).id = (token as unknown as RoleJwt).uid;
          (session.user as unknown as { sitterId?: unknown }).sitterId = (token as unknown as RoleJwt).sitterId;

          if (typeof token.name === "string") {
            session.user.name = token.name;
          }
        }
        return session;
      } catch (err) {
        console.error("[next-auth][session] callback failed", {
          err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
        });
        return session;
      }
    },
    async signIn(params: any) {
      try {
        const user = params?.user as User | undefined;
        const account = params?.account as { provider?: unknown; type?: unknown } | undefined;
        const profile = params?.profile as { email?: unknown; sub?: unknown } | undefined;

        console.log("[next-auth][signIn] callback", {
          user: user ? { id: user.id, email: user.email, name: user.name } : null,
          account: account ? { provider: account.provider, type: account.type } : null,
          profile: profile ? { email: profile.email, sub: profile.sub } : null,
          minimalOauth,
        });

        if (!user?.email) {
          console.error("[next-auth][signIn] missing user/email", {
            user: user ? { id: user.id, email: user.email, name: user.name } : null,
          });
          return false;
        }

        if (!minimalOauth) {
          try {
            await applyWantedRoleByEmail(user.email);
          } catch (err) {
            console.error("[next-auth][signIn] applyWantedRoleByEmail failed (non-blocking)", {
              email: user.email,
              err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
            });
          }
        }

        console.log("[next-auth][signIn] allow", { email: user.email, minimalOauth });
        return true;
      } catch (err) {
        console.error("[next-auth][signIn] callback failed", {
          err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
        });
        return true;
      }
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      try {
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch (err) {
        console.error("[next-auth][redirect] invalid redirect", {
          url,
          baseUrl,
          err: err instanceof Error ? { name: err.name, message: err.message } : err,
        });
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
      console.log("[next-auth][event][createUser]", { id: user.id, email: user.email, minimalOauth });
      if (minimalOauth) return;
      try {
        await applyWantedRoleByEmail(user.email);
      } catch (err) {
        console.error("[next-auth][event][createUser] applyWantedRoleByEmail failed (non-blocking)", {
          email: user.email,
          err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
        });
      }
    },
    async signIn(message: any) {
      console.log("[next-auth][event][signIn]", {
        user: { id: message.user?.id, email: message.user?.email },
        account: { provider: message.account?.provider, type: message.account?.type },
        minimalOauth,
      });
    },
    async linkAccount(message: any) {
      console.log("[next-auth][event][linkAccount]", {
        user: { id: message.user?.id, email: message.user?.email },
        account: { provider: message.account?.provider, type: message.account?.type },
        minimalOauth,
      });
    },
    async session(message: any) {
      console.log("[next-auth][event][session]", {
        sessionUser: message.session?.user ? { email: message.session.user.email, name: message.session.user.name } : null,
        minimalOauth,
      });
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
