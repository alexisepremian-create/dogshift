import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function isBlockedStatus(status: string) {
  return status === "CANCELLED" || status === "REFUNDED" || status === "REFUND_FAILED" || status === "PAYMENT_FAILED";
}

function isPaidStatus(status: string) {
  return status === "PAID" || status === "CONFIRMED";
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const bookingId = (searchParams.get("bookingId") ?? "").trim();
    if (!bookingId) return NextResponse.json({ ok: false, error: "INVALID_BOOKING_ID" }, { status: 400 });

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, sitterId: true, status: true, endDate: true },
    });

    if (!booking) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (String(booking.userId) !== userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const status = String(booking.status ?? "");
    if (isBlockedStatus(status)) {
      return NextResponse.json({ ok: true, eligible: false, reason: "BLOCKED_STATUS", status }, { status: 200 });
    }

    if (!isPaidStatus(status)) {
      return NextResponse.json({ ok: true, eligible: false, reason: "NOT_PAID", status }, { status: 200 });
    }

    const end = booking.endDate instanceof Date ? booking.endDate : booking.endDate ? new Date(booking.endDate) : null;
    if (!end || Number.isNaN(end.getTime())) {
      return NextResponse.json({ ok: true, eligible: false, reason: "MISSING_END_DATE", status }, { status: 200 });
    }

    if (Date.now() <= end.getTime()) {
      return NextResponse.json({ ok: true, eligible: false, reason: "NOT_ENDED", status, endAt: end.toISOString() }, { status: 200 });
    }

    const existing = await (prisma as any).review.findUnique({
      where: { bookingId },
      select: { id: true, ownerId: true },
    });

    if (existing) {
      const canEdit = String(existing.ownerId ?? "") === userId;
      return NextResponse.json({ ok: true, eligible: true, alreadyReviewed: true, canEdit }, { status: 200 });
    }

    return NextResponse.json({ ok: true, eligible: true, alreadyReviewed: false, canEdit: true }, { status: 200 });
  } catch (err) {
    console.error("[api][reviews][eligibility][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
