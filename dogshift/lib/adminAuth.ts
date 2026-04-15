import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

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
  const { userId } = await auth();
  const sessionValue = await getAdminSessionFromCookies();

  return {
    userId,
    isAuthenticated: Boolean(userId),
    isAdmin: Boolean(userId) && isValidAdminSessionValue(sessionValue),
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
  const { userId } = await auth();
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

  const byCookie = Boolean(userId) && isValidAdminSessionValue(cookieSession);
  // For direct API access via header, also require the email to be whitelisted
  const byHeader = isValidAdminCode(headerCode) && (headerEmail ? isAdminEmail(headerEmail) : true);
  const isAdmin = byCookie || byHeader;

  if (!isAdmin) {
    console.warn("[adminAuth][getRequestAdminAccess] denied", {
      userId: userId ?? null,
      hasClerkSession: Boolean(userId),
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
