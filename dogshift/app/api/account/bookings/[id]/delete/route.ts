/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";
import { canOwnerArchiveOrDelete } from "@/lib/bookings/ownerBookingMutation";

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

/**
 * Soft-delete an ARCHIVED booking from the owner's view. Sets `deletedAt` — the
 * row (and its immutable finance/audit records) stays in the DB; the list query
 * filters `deletedAt: null`. Same rule as archive: an active CONFIRMED booking
 * that hasn't passed yet cannot be deleted.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = await params;
    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        status: true,
        archivedAt: true,
        deletedAt: true,
        startAt: true,
        endAt: true,
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
    if (booking.deletedAt) {
      return NextResponse.json({ ok: true, id: bookingId }, { status: 200 });
    }
    // Only archived bookings can be permanently removed.
    if (!booking.archivedAt) {
      return NextResponse.json({ ok: false, error: "NOT_ARCHIVED" }, { status: 409 });
    }
    if (!canOwnerArchiveOrDelete(booking)) {
      return NextResponse.json({ ok: false, error: "CONFIRMED_NOT_PASSED" }, { status: 409 });
    }

    await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { deletedAt: new Date() },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: bookingId }, { status: 200 });
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Run: prisma migrate deploy (Booking.deletedAt)" },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][bookings][id][delete][POST] error", { err });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
