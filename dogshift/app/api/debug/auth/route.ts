import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = (req.nextUrl.searchParams.get("token") ?? "").trim();
    const expected = (process.env.DEBUG_AUTH_TOKEN ?? "").trim();

    if (!expected || token !== expected) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { userId, sessionId } = await auth();

    const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0]?.trim();
    const host = (forwardedHost || req.headers.get("host") || "").split(",")[0]?.trim();
    const forwardedProto = (req.headers.get("x-forwarded-proto") || "").split(",")[0]?.trim();

    const cookieNames = req.cookies
      .getAll()
      .map((c) => c.name)
      .filter((name) => {
        const n = name.toLowerCase();
        return n.includes("__session") || n.includes("__client") || n.includes("clerk") || n.includes("session");
      })
      .slice(0, 50);

    const payload = {
      ok: true,
      userId: userId ?? null,
      sessionId: sessionId ?? null,
      host: host || null,
      proto: forwardedProto || null,
      cookieNames,
    };

    console.log("[api][debug][auth]", payload);

    const res = NextResponse.json(payload, { status: 200 });
    res.headers.set("cache-control", "no-store");
    return res;
  } catch (err) {
    console.error("[api][debug][auth][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
