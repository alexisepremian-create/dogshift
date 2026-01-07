import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const expected = (process.env.SITE_ACCESS_CODE ?? "").trim();

    if (!expected) {
      return NextResponse.json({ ok: true, disabled: true }, { status: 200 });
    }

    const body = (await req.json().catch(() => null)) as { code?: unknown; next?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code : "";

    if (code !== expected) {
      return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set({
      name: "dogshift_access",
      value: "true",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    console.error("[api][access] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
