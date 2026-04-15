import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * This legacy endpoint is disabled.
 * Authentication is handled exclusively via Clerk.
 */
export async function POST() {
  return NextResponse.json({ ok: false, error: "GONE" }, { status: 410 });
}
