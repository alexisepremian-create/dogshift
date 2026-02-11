import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams =
      typeof (params as any)?.then === "function"
        ? await (params as Promise<{ id: string }>)
        : (params as { id: string });

    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const userId = await resolveDbUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const db = prisma as unknown as { booking: any };
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (booking.status === "PAID" || booking.status === "CONFIRMED") {
      return NextResponse.json({ ok: false, error: "CANNOT_CANCEL_PAID" }, { status: 409 });
    }

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });

    return NextResponse.json({ ok: true, booking: updated }, { status: 200 });
  } catch (err) {
    console.error("[api][bookings][id][cancel] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
