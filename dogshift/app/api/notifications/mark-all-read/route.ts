import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { markAllRead } from "@/lib/notifications/inApp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const updated = await markAllRead(userId);
    return NextResponse.json({ ok: true, updated }, { status: 200 });
  } catch (err) {
    console.error("[api][notifications][mark-all-read][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
