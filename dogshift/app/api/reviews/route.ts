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

    const review = await (prisma as any).review.findUnique({
      where: { bookingId },
      select: { id: true, bookingId: true, ownerId: true, sitterId: true, rating: true, comment: true, anonymous: true, createdAt: true, updatedAt: true },
    });

    if (!review) return NextResponse.json({ ok: true, review: null }, { status: 200 });
    if (String(review.ownerId ?? "") !== userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    return NextResponse.json(
      {
        ok: true,
        review: {
          id: String(review.id),
          bookingId: String(review.bookingId),
          sitterId: String(review.sitterId),
          rating: Number(review.rating ?? 0),
          comment: typeof review.comment === "string" ? review.comment : null,
          anonymous: Boolean(review.anonymous),
          createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : new Date(review.createdAt).toISOString(),
          updatedAt: review.updatedAt instanceof Date ? review.updatedAt.toISOString() : new Date(review.updatedAt).toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][reviews][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as any;
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
    const ratingRaw = typeof body?.rating === "number" ? body.rating : Number(body?.rating);
    const comment = typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim() : null;
    const anonymous = Boolean(body?.anonymity ?? body?.anonymous);

    if (!bookingId) return NextResponse.json({ ok: false, error: "INVALID_BOOKING_ID" }, { status: 400 });

    const rating = Math.round(Number.isFinite(ratingRaw) ? ratingRaw : NaN);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ ok: false, error: "INVALID_RATING" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, sitterId: true, status: true, endDate: true },
    });

    if (!booking) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if (String(booking.userId) !== userId) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const status = String(booking.status ?? "");
    if (isBlockedStatus(status)) return NextResponse.json({ ok: false, error: "BLOCKED_STATUS" }, { status: 409 });
    if (!isPaidStatus(status)) return NextResponse.json({ ok: false, error: "NOT_PAID" }, { status: 409 });

    const end = booking.endDate instanceof Date ? booking.endDate : booking.endDate ? new Date(booking.endDate) : null;
    if (!end || Number.isNaN(end.getTime())) return NextResponse.json({ ok: false, error: "MISSING_END_DATE" }, { status: 409 });
    if (Date.now() <= end.getTime()) return NextResponse.json({ ok: false, error: "NOT_ENDED" }, { status: 409 });

    const sitterId = typeof booking.sitterId === "string" ? booking.sitterId.trim() : "";
    if (!sitterId) return NextResponse.json({ ok: false, error: "MISSING_SITTER" }, { status: 409 });

    const saved = await (prisma as any).review.upsert({
      where: { bookingId },
      create: {
        bookingId,
        ownerId: userId,
        sitterId,
        rating,
        comment,
        anonymous,
      },
      update: {
        rating,
        comment,
        anonymous,
      },
      select: { id: true, bookingId: true, sitterId: true, rating: true, comment: true, anonymous: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(
      {
        ok: true,
        review: {
          id: String(saved.id),
          bookingId: String(saved.bookingId),
          sitterId: String(saved.sitterId),
          rating: Number(saved.rating ?? 0),
          comment: typeof saved.comment === "string" ? saved.comment : null,
          anonymous: Boolean(saved.anonymous),
          createdAt: saved.createdAt instanceof Date ? saved.createdAt.toISOString() : new Date(saved.createdAt).toISOString(),
          updatedAt: saved.updatedAt instanceof Date ? saved.updatedAt.toISOString() : new Date(saved.updatedAt).toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][reviews][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
