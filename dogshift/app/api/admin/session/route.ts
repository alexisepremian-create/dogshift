import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";

import { ADMIN_SESSION_COOKIE, createAdminSessionValue, isAdminEmail, isValidAdminCode } from "@/lib/adminAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
};

export async function POST(req: NextRequest) {
  try {
    // Rate limit: max 5 attempts per IP per 10 minutes
    const ip = getClientIp(req);
    const rl = checkRateLimit(`admin-session:${ip}`, { limit: 5, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const __authed = await getAuthedDbUser();
    const userId = __authed?.id ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Email whitelist: only allowed emails can access the admin panel
    // currentUser() removed — use __authed.email / __authed.name
    const email = __authed?.email ?? "";
    if (!email || !isAdminEmail(email)) {
      console.warn("[api][admin][session][POST] email not whitelisted", { email: email || "(none)" });
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!isValidAdminCode(code)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionValue(), sessionCookieOptions);
    return res;
  } catch (error) {
    console.error("[api][admin][session][POST] error", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return res;
}
