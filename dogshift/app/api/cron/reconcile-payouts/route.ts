/**
 * Daily backstop that detects bookings whose service has ended but whose Stripe transfer
 * was never created. Each missed payout is logged as a critical error (caught by Sentry)
 * and the transfer is attempted on the spot using source_transaction when a chargeId is
 * available. The main release-booking-payouts cron runs every 15 min and should handle
 * all normal cases; this cron is the safety net for any silent failures.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { syncBookingPaymentDetails } from "@/lib/stripe/bookingPayments";

export const runtime = "nodejs";

// Only flag bookings that ended at least this many hours ago, giving the main cron
// enough time to have run (it fires every 15 min, so 2 h is very conservative).
const STALE_THRESHOLD_HOURS = 2;

function readCronSecretFromRequest(req: NextRequest) {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice("bearer ".length).trim();
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
  const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);

  let detected = 0;
  let fixed = 0;
  let fixFailed = 0;
  const missed: { bookingId: string; endDate: string; amount: number; sitterId: string }[] = [];

  try {
    const bookings = await (prisma as any).booking.findMany({
      where: {
        endDate: { lte: staleThreshold },
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
        payoutMethod: true,
        amount: true,
        currency: true,
        endDate: true,
        platformFeeAmount: true,
        stripePaymentIntentId: true,
        stripeChargeId: true,
      },
      orderBy: { endDate: "asc" },
      take: 100,
    });

    for (const booking of bookings ?? []) {
      const bookingId = String(booking.id);

      if (booking.payoutMethod === "MANUAL") {
        continue;
      }

      detected += 1;
      missed.push({
        bookingId,
        endDate: booking.endDate instanceof Date ? booking.endDate.toISOString() : String(booking.endDate),
        amount: booking.amount,
        sitterId: String(booking.sitterId),
      });

      console.error("[api][cron][reconcile-payouts] MISSED TRANSFER DETECTED", {
        bookingId,
        sitterId: String(booking.sitterId),
        amount: booking.amount,
        endDate: booking.endDate,
        stripePaymentIntentId: booking.stripePaymentIntentId,
        stripeChargeId: booking.stripeChargeId || null,
      });

      try {
        const sitterProfile = await (prisma as any).sitterProfile.findUnique({
          where: { sitterId: String(booking.sitterId) },
          select: { stripeAccountId: true, stripeAccountStatus: true },
        });

        const destination = typeof sitterProfile?.stripeAccountId === "string" ? sitterProfile.stripeAccountId.trim() : "";
        const destinationStatus = typeof sitterProfile?.stripeAccountStatus === "string" ? sitterProfile.stripeAccountStatus.trim() : "";

        if (!destination || destinationStatus !== "ENABLED") {
          console.warn("[api][cron][reconcile-payouts] sitter account not ready, cannot fix", {
            bookingId,
            destination: destination || null,
            destinationStatus: destinationStatus || null,
          });
          fixFailed += 1;
          continue;
        }

        const paymentIntentId = typeof booking.stripePaymentIntentId === "string" ? booking.stripePaymentIntentId.trim() : "";
        if (!paymentIntentId) {
          fixFailed += 1;
          continue;
        }

        const synced = await syncBookingPaymentDetails({
          bookingId,
          paymentIntentId,
          chargeId: typeof booking.stripeChargeId === "string" ? booking.stripeChargeId : undefined,
        });

        if (!synced.ok) {
          console.error("[api][cron][reconcile-payouts] sync failed, cannot fix", { bookingId, error: synced.error });
          fixFailed += 1;
          continue;
        }

        const chargeId =
          (typeof synced.chargeId === "string" && synced.chargeId ? synced.chargeId : null) ||
          (typeof booking.stripeChargeId === "string" && booking.stripeChargeId ? booking.stripeChargeId : null);

        const payoutAmount = typeof synced.payoutAmount === "number" ? synced.payoutAmount : 0;
        const grossAmount = typeof booking.amount === "number" ? booking.amount : 0;
        const stripeFeeAmount = typeof synced.stripeFeeAmount === "number" ? synced.stripeFeeAmount : 0;
        const platformFeeAmount = typeof booking.platformFeeAmount === "number" ? booking.platformFeeAmount : 0;
        const netAmount = Math.max(0, grossAmount - stripeFeeAmount - platformFeeAmount);
        const transferAmount = payoutAmount > 0 ? payoutAmount : netAmount;

        if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
          console.error("[api][cron][reconcile-payouts] computed transfer amount is zero, cannot fix", {
            bookingId, payoutAmount, netAmount,
          });
          fixFailed += 1;
          continue;
        }

        const transferParams: Stripe.TransferCreateParams = {
          amount: transferAmount,
          currency: String(booking.currency || "chf").toLowerCase(),
          destination,
          transfer_group: `booking:${bookingId}`,
          metadata: {
            bookingId,
            sitterId: String(booking.sitterId),
            paymentIntentId,
            fixedBy: "reconcile-payouts-cron",
            grossAmount: String(grossAmount),
            platformFeeAmount: String(platformFeeAmount),
            payoutAmount: String(transferAmount),
          },
        };

        if (chargeId) {
          transferParams.source_transaction = chargeId;
        }

        const transfer = await stripe.transfers.create(transferParams, {
          idempotencyKey: `transfer:booking:${bookingId}:${paymentIntentId}:${transferAmount}`,
        });

        if (!transfer?.id) throw new Error("missing transfer id");

        await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            stripeTransferId: transfer.id,
            payoutReleasedAt: new Date(),
            sitterPayoutAmount: transferAmount,
          },
          select: { id: true },
        });

        fixed += 1;
        console.log("[api][cron][reconcile-payouts] missed transfer fixed", {
          bookingId,
          transferId: transfer.id,
          transferAmount,
          chargeId: chargeId || null,
        });
      } catch (err) {
        fixFailed += 1;
        console.error("[api][cron][reconcile-payouts] fix attempt failed", { bookingId, err });
      }
    }

    return NextResponse.json(
      { ok: true, detected, fixed, fixFailed, missed, asOf: now.toISOString() },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][cron][reconcile-payouts] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
