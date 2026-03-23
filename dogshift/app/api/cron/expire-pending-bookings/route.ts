import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { expirePendingAcceptanceBooking } from "@/lib/bookings/expirePendingAcceptanceBooking";

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

function readThresholdHours() {
  const raw = (process.env.BOOKING_AUTO_EXPIRE_UNACCEPTED_HOURS || "24").trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return Math.trunc(parsed);
}

async function createSupportAdminNote(targetId: string, body: string) {
  try {
    await (prisma as any).adminNote.create({
      data: {
        targetType: "BOOKING",
        targetId,
        body,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[api][cron][expire-pending-bookings] admin note failed", { targetId, err });
  }
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
  const thresholdHours = readThresholdHours();
  const cutoff = new Date(now.getTime() + thresholdHours * 60 * 60 * 1000);

  let processed = 0;
  let refunded = 0;
  let cancelledAuthorizations = 0;
  let alreadyRefunded = 0;
  let alreadyTerminal = 0;
  let notDue = 0;
  let failed = 0;

  try {
    const bookings = await (prisma as any).booking.findMany({
      where: {
        status: { in: ["PENDING_ACCEPTANCE", "PAID"] },
        canceledAt: null,
        refundedAt: null,
        startDate: { not: null, lte: cutoff },
      },
      select: {
        id: true,
        status: true,
        startDate: true,
      },
      orderBy: { startDate: "asc" },
      take: 200,
    });

    for (const booking of bookings ?? []) {
      const bookingId = String(booking.id);
      processed += 1;

      try {
        const result = await expirePendingAcceptanceBooking({
          bookingId,
          req,
          thresholdHours,
          now,
        });

        if (!result.ok) {
          failed += 1;
          await createSupportAdminNote(
            bookingId,
            `AUTO_EXPIRE_PENDING_ACCEPTANCE refund failed at ${now.toISOString()} (threshold=${thresholdHours}h): ${result.error}`
          );
          continue;
        }

        if (result.action === "refunded") {
          refunded += 1;
          await createSupportAdminNote(
            bookingId,
            `AUTO_EXPIRE_PENDING_ACCEPTANCE refunded automatically at ${now.toISOString()} (threshold=${thresholdHours}h).`
          );
          continue;
        }

        if (result.action === "cancelled_authorization") {
          cancelledAuthorizations += 1;
          await createSupportAdminNote(
            bookingId,
            `AUTO_EXPIRE_PENDING_ACCEPTANCE cancelled uncaptured authorization at ${now.toISOString()} (threshold=${thresholdHours}h).`
          );
          continue;
        }

        if (result.action === "already_refunded") {
          alreadyRefunded += 1;
          continue;
        }

        if (result.action === "already_terminal") {
          alreadyTerminal += 1;
          continue;
        }

        if (result.action === "not_due") {
          notDue += 1;
        }
      } catch (err) {
        failed += 1;
        console.error("[api][cron][expire-pending-bookings] booking failed", { bookingId, err });
        await createSupportAdminNote(
          bookingId,
          `AUTO_EXPIRE_PENDING_ACCEPTANCE unexpected failure at ${now.toISOString()} (threshold=${thresholdHours}h).`
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        thresholdHours,
        cutoff: cutoff.toISOString(),
        processed,
        refunded,
        cancelledAuthorizations,
        alreadyRefunded,
        alreadyTerminal,
        notDue,
        failed,
        asOf: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][cron][expire-pending-bookings] error", { err, thresholdHours, cutoff: cutoff.toISOString() });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
