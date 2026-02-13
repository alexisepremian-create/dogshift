import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { markOneRead } from "@/lib/notifications/inApp";

export const runtime = "nodejs";

type Body = { id?: unknown };

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Body;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

    const updated = await markOneRead(userId, id);
    return NextResponse.json({ ok: true, updated }, { status: 200 });
  } catch (err) {
    console.error("[api][notifications][mark-read][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
