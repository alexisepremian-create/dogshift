import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { auth } from "@/auth";

// ⚠️  Variable HOST_ADMIN_CODE doit être un mot de passe fort configuré sur Vercel.
//     Si tu le changes sur Vercel, les sessions admin actives seront invalidées (c'est voulu).
export const ADMIN_SESSION_COOKIE = "ds_admin_session";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getExpectedAdminCode() {
  return (process.env.HOST_ADMIN_CODE ?? "").trim();
}

/**
 * Returns the list of emails allowed to access the admin panel.
 * Reads from ADMIN_EMAILS (comma-separated). Falls back to empty list.
 *
 * ⚠️  Variable d'environnement ADMIN_EMAILS doit être configurée sur Vercel.
 *     Format : "alexis.epremian@gmail.com" ou "email1@x.com,email2@x.com"
 *     Si non configurée → fallback : TOUT utilisateur connecté peut accéder (dangereux !).
 *     Pour ajouter un co-admin : ajouter son email dans ADMIN_EMAILS sur Vercel + redéployer.
 */
export function getAdminAllowedEmails(): string[] {
  const raw = (process.env.ADMIN_EMAILS ?? "").trim();
  if (!raw) return [];
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const allowed = getAdminAllowedEmails();
  if (allowed.length === 0) return true; // fallback: allow all if not configured
  return allowed.includes(email.trim().toLowerCase());
}

function hashAdminCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function isValidAdminCode(code: string) {
  const expected = getExpectedAdminCode();
  if (!expected || !code) return false;
  return safeEqual(code.trim(), expected);
}

export function createAdminSessionValue() {
  const expected = getExpectedAdminCode();
  if (!expected) return "";
  return hashAdminCode(expected);
}

export function isValidAdminSessionValue(value: string) {
  if (!value) return false;
  const expected = createAdminSessionValue();
  if (!expected) return false;
  return safeEqual(value, expected);
}

export async function getAdminSessionFromCookies() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value?.trim() ?? "";
  return value;
}

export async function getAdminAccessState() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? "";
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  const sessionValue = await getAdminSessionFromCookies();
  const validCookie = isValidAdminSessionValue(sessionValue);

  // Belt + suspenders: a valid HOST_ADMIN_CODE cookie is no longer enough.
  // We also require the Auth.js session role to be ADMIN AND the email to be
  // on the ADMIN_EMAILS whitelist. Either layer alone is insufficient.
  const isAdmin =
    Boolean(userId) &&
    role === "ADMIN" &&
    isAdminEmail(email) &&
    validCookie;

  return {
    userId,
    isAuthenticated: Boolean(userId),
    isAdmin,
  };
}

export async function requireAdminPageAccess(nextPath = "/admin/dashboard") {
  const state = await getAdminAccessState();
  if (!state.isAuthenticated) {
    redirect(`/login?next=${encodeURIComponent("/admin/login")}`);
  }
  if (!state.isAdmin) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
  }
  return state;
}

export async function getRequestAdminAccess(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? "";
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;

  const headerCode = req.headers.get("x-admin-code")?.trim() ?? "";
  const headerEmail = req.headers.get("x-admin-email")?.trim().toLowerCase() ?? "";

  // Read cookie from both sources for resilience — Next.js App Router can
  // behave differently between req.cookies and the cookies() helper.
  const fromReq = req.cookies.get(ADMIN_SESSION_COOKIE)?.value?.trim() ?? "";
  let fromHeaders = "";
  try {
    fromHeaders = (await getAdminSessionFromCookies()) ?? "";
  } catch {
    // cookies() can throw outside of request scope; ignore
  }
  const cookieSession = fromReq || fromHeaders;

  // Belt + suspenders for cookie path: requires Auth.js session role=ADMIN,
  // email on whitelist, AND a valid HOST_ADMIN_CODE cookie.
  const byCookie =
    Boolean(userId) &&
    role === "ADMIN" &&
    isAdminEmail(email) &&
    isValidAdminSessionValue(cookieSession);

  // Header path is for backend-to-backend / one-off ops with no session: the
  // caller must know the code AND supply an admin email matching the whitelist.
  const byHeader =
    isValidAdminCode(headerCode) && Boolean(headerEmail) && isAdminEmail(headerEmail);

  const isAdmin = byCookie || byHeader;

  if (!isAdmin) {
    console.warn("[adminAuth][getRequestAdminAccess] denied", {
      userId: userId ?? null,
      hasSession: Boolean(userId),
      sessionRole: role,
      sessionEmailOnWhitelist: email ? isAdminEmail(email) : null,
      cookieFromReq: Boolean(fromReq),
      cookieFromHeaders: Boolean(fromHeaders),
      hasExpectedAdminCode: Boolean(getExpectedAdminCode()),
      byCookie,
      byHeader,
      pathname: req.nextUrl?.pathname ?? null,
    });
  }

  return {
    userId,
    isAuthenticated: Boolean(userId),
    isAdmin,
  };
}
