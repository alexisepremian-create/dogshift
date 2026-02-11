import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

export async function GET(
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
      select: {
        id: true,
        userId: true,
        sitterId: true,
        service: true,
        startDate: true,
        endDate: true,
        message: true,
        status: true,
        amount: true,
        currency: true,
        platformFeeAmount: true,
        stripeSessionId: true,
        stripePaymentIntentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, booking }, { status: 200 });
  } catch (err) {
    console.error("[api][bookings][id] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
