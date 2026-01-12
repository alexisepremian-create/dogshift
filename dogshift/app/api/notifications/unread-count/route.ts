import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { getUnreadCount } from "@/lib/notifications/inApp";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const total = await getUnreadCount(userId);
    return NextResponse.json({ ok: true, total }, { status: 200 });
  } catch (err) {
    console.error("[api][notifications][unread-count][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
