import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { listNotifications } from "@/lib/notifications/inApp";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("limit") || "10";
    const limit = Number.parseInt(raw, 10);

    const items = await listNotifications(userId, Number.isFinite(limit) ? limit : 10);
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err) {
    console.error("[api][notifications][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
