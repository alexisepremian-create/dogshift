import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { cancelUnpaidBooking } from "@/lib/bookings/bookingHold";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    const { id } = await params;
    const result = await cancelUnpaidBooking(id, userId);
    return NextResponse.json(result, { status: result.ok ? 200 : result.error === "NOT_FOUND" ? 404 : 409 });
  } catch {
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
