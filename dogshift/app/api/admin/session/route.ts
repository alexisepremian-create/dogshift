import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { ADMIN_SESSION_COOKIE, createAdminSessionValue, isValidAdminCode } from "@/lib/adminAuth";

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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
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
