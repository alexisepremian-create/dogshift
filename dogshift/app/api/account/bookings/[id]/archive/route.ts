import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveDbUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const userId = await resolveDbUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await (params as Promise<{ id: string }>) : (params as { id: string });
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
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== userId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (booking.archivedAt) {
      return NextResponse.json({ ok: true, id: bookingId, archivedAt: booking.archivedAt instanceof Date ? booking.archivedAt.toISOString() : String(booking.archivedAt) }, { status: 200 });
    }

    const status = String(booking.status ?? "");
    if (status !== "DRAFT" && status !== "PENDING_PAYMENT") {
      return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 409 });
    }

    const now = new Date();
    const updated = await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { archivedAt: now },
      select: { id: true, archivedAt: true },
    });

    return NextResponse.json(
      {
        ok: true,
        id: String(updated.id ?? bookingId),
        archivedAt: updated.archivedAt instanceof Date ? updated.archivedAt.toISOString() : String(updated.archivedAt ?? now.toISOString()),
      },
      { status: 200 }
    );
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][bookings][id][archive][POST] error", { err });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
