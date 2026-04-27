import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestAdminAccess } from "@/lib/adminAuth";
import { logAdminAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { isAdmin, userId } = await getRequestAdminAccess(req);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const resolvedParams = await params;
    const bookingId = typeof resolvedParams?.id === "string" ? resolvedParams.id.trim() : "";
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, archivedAt: true },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.archivedAt) {
      return NextResponse.json(
        { ok: true, id: bookingId, alreadyArchived: true, archivedAt: booking.archivedAt instanceof Date ? booking.archivedAt.toISOString() : String(booking.archivedAt) },
        { status: 200 },
      );
    }

    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { archivedAt: now },
      select: { id: true, archivedAt: true },
    });

    logAdminAudit({
      action: "booking.archive",
      adminUserId: userId ?? "unknown",
      targetId: bookingId,
      targetType: "BOOKING",
      detail: { previousStatus: booking.status },
    });

    return NextResponse.json(
      { ok: true, id: String(updated.id), archivedAt: updated.archivedAt instanceof Date ? updated.archivedAt.toISOString() : String(updated.archivedAt ?? now.toISOString()) },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][admin][bookings][id][archive][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
