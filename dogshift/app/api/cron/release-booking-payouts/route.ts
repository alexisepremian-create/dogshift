import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { syncBookingPaymentDetails } from "@/lib/stripe/bookingPayments";

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
  let processed = 0;
  let released = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const bookings = await (prisma as any).booking.findMany({
      where: {
        endDate: { lte: now },
        status: { in: ["PAID", "CONFIRMED"] },
        canceledAt: null,
        refundedAt: null,
        stripePaymentIntentId: { not: null },
        stripeTransferId: null,
        payoutReleasedAt: null,
      },
      select: {
        id: true,
        sitterId: true,
        amount: true,
        currency: true,
        endDate: true,
        stripePaymentIntentId: true,
        stripeTransferId: true,
        stripeProcessingFeeAmount: true,
        platformFeeAmount: true,
        sitterPayoutAmount: true,
      },
      orderBy: { endDate: "asc" },
      take: 200,
    });

    for (const booking of bookings ?? []) {
      const bookingId = String(booking.id);
      processed += 1;

      try {
        const sitterProfile = await (prisma as any).sitterProfile.findUnique({
          where: { sitterId: String(booking.sitterId) },
          select: { stripeAccountId: true, stripeAccountStatus: true },
        });

        const destination = typeof sitterProfile?.stripeAccountId === "string" ? sitterProfile.stripeAccountId.trim() : "";
        const destinationStatus = typeof sitterProfile?.stripeAccountStatus === "string" ? sitterProfile.stripeAccountStatus.trim() : "";

        if (!destination || destinationStatus !== "ENABLED") {
          skipped += 1;
          continue;
        }

        const paymentIntentId = typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId.trim() : "";
        if (!paymentIntentId) {
          skipped += 1;
          continue;
        }

        const synced = await syncBookingPaymentDetails({
          bookingId,
          paymentIntentId,
        });

        if (!synced.ok) {
          failed += 1;
          continue;
        }

        const payoutAmount = typeof synced.payoutAmount === "number" ? synced.payoutAmount : 0;
        const grossAmount = typeof booking.amount === "number" ? booking.amount : 0;
        const stripeFeeAmount = typeof synced.stripeFeeAmount === "number" ? synced.stripeFeeAmount : 0;
        const platformFeeAmount = typeof booking.platformFeeAmount === "number" ? booking.platformFeeAmount : 0;

        console.log("[api][cron][release-booking-payouts] computed payout", {
          bookingId,
          grossAmount,
          stripeFeeAmount,
          platformFeeAmount,
          payoutAmount,
        });

        if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
          skipped += 1;
          continue;
        }

        const transfer = await stripe.transfers.create(
          {
            amount: payoutAmount,
            currency: String(booking.currency || "chf").toLowerCase(),
            destination,
            transfer_group: `booking:${bookingId}`,
            metadata: {
              bookingId,
              sitterId: String(booking.sitterId),
              paymentIntentId,
              grossAmount: String(grossAmount),
              stripeFeeAmount: String(stripeFeeAmount),
              platformFeeAmount: String(platformFeeAmount),
              payoutAmount: String(payoutAmount),
            },
          },
          {
            idempotencyKey: `transfer:booking:${bookingId}:${paymentIntentId}:${payoutAmount}`,
          }
        );

        await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            stripeTransferId: transfer.id,
            payoutReleasedAt: new Date(),
            sitterPayoutAmount: payoutAmount,
          },
          select: { id: true },
        });

        released += 1;
      } catch (err) {
        failed += 1;
        console.error("[api][cron][release-booking-payouts] booking failed", { bookingId, err });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        processed,
        released,
        skipped,
        failed,
        asOf: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][cron][release-booking-payouts] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
