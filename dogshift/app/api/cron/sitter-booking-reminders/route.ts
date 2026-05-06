/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { resolveBookingParticipants, sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

export const runtime = "nodejs";

function readCronSecretFromRequest(req: NextRequest) {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "MISSING_CRON_SECRET" }, { status: 500 });
  }

  const provided = readCronSecretFromRequest(req);
  if (!provided || provided !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 18 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 30 * 60 * 60 * 1000);

  try {
    const bookings = await (prisma as any).booking.findMany({
      where: {
        status: "CONFIRMED",
        startDate: {
          gte: windowStart,
          lt: windowEnd,
        },
      },
      select: { id: true },
      take: 200,
      orderBy: { startDate: "asc" },
    });

    let processed = 0;
    let sent = 0;
    let skipped = 0;

    for (const b of bookings) {
      const bookingId = String(b.id);
      processed += 1;

      try {
        const participants = await resolveBookingParticipants(bookingId);
        if (!participants?.sitter?.id) {
          skipped += 1;
          continue;
        }

        const startsAtIso = participants.startsAtIso || "";

        const res = await sendNotificationEmail({
          req,
          recipientUserId: participants.sitter.id,
          key: "sitterBookingReminder",
          entityId: `${bookingId}:sitter:24h`,
          payload: { kind: "sitterBookingReminder", bookingId, startsAtIso },
        });
        if (res.ok && !res.skipped) sent += 1;
        if (res.ok && res.skipped) skipped += 1;
      } catch (err) {
        console.error("[api][cron][sitter-booking-reminders] booking failed", { bookingId, err });
      }
    }

    return NextResponse.json(
      { ok: true, window: { start: windowStart.toISOString(), end: windowEnd.toISOString() }, processed, sent, skipped },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api][cron][sitter-booking-reminders] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
