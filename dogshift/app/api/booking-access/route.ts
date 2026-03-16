import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { BOOKING_ACCESS_COOKIE, getExpectedBookingAccessCode } from "@/lib/bookingAccess";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const expected = getExpectedBookingAccessCode();

    if (!expected) {
      return NextResponse.json({ ok: true, disabled: true }, { status: 200 });
    }

    const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!code) {
      return NextResponse.json({ ok: false, error: "CODE_REQUIRED" }, { status: 400 });
    }

    if (code !== expected) {
      return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set({
      name: BOOKING_ACCESS_COOKIE,
      value: "true",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (err) {
    console.error("[api][booking-access] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
