import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as null | { sitterId?: string };
    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    if (!sitterId) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const res = await fetch(`${BASE}/api/agents/pension-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sitterId }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, ...data });
  } catch (err) {
    console.error("[api][admin][pension-verifications][ai-review]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
