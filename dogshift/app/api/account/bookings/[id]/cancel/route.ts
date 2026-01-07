import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RoleJwt = { uid?: string; sub?: string };

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

function isCompleted(status: string, endDateIso: string | null) {
  if (status !== "PAID" && status !== "CONFIRMED") return false;
  if (!endDateIso) return false;
  const end = new Date(endDateIso).getTime();
  if (!Number.isFinite(end)) return false;
  return Date.now() > end;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const userId = tokenUserId(token);
    if (!userId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][cancel][PATCH] UNAUTHORIZED", { hasToken: Boolean(token) });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!bookingId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][id][cancel][PATCH] INVALID_ID", { bookingIdRaw: resolvedParams?.id });
      }
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const status = String(booking.status ?? "");

    if (status === "CANCELLED") {
      return NextResponse.json({ ok: false, error: "ALREADY_CANCELED" }, { status: 409 });
    }

    const endIso = booking.endDate instanceof Date ? booking.endDate.toISOString() : booking.endDate ? new Date(booking.endDate).toISOString() : null;
    if (isCompleted(status, endIso)) {
      return NextResponse.json({ ok: false, error: "ALREADY_COMPLETED" }, { status: 409 });
    }

    const startIso = booking.startDate instanceof Date ? booking.startDate.toISOString() : booking.startDate ? new Date(booking.startDate).toISOString() : null;
    if (startIso) {
      const startTs = new Date(startIso).getTime();
      if (Number.isFinite(startTs)) {
        const limit = startTs - 24 * 60 * 60 * 1000;
        if (Date.now() > limit) {
          return NextResponse.json({ ok: false, error: "TOO_LATE" }, { status: 409 });
        }
      }
    }

    const updated = await (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        canceledAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        canceledAt: true,
        startDate: true,
        endDate: true,
        updatedAt: true,
      },
    });

    // TODO: handle Stripe refund (not in MVP)

    return NextResponse.json({ ok: true, booking: updated }, { status: 200 });
  } catch (err) {
    console.error("[api][account][bookings][id][cancel][PATCH] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
