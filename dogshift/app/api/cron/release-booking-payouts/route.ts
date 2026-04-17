import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type Stripe from "stripe";

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
    // Retrieve available balance for fallback use when no source_transaction is available.
    // With source_transaction, Stripe links the transfer directly to the charge and does
    // NOT require available balance — so we no longer exit early when balance is 0.
    const balanceResponse = await stripe.balance.retrieve();
    const chfAvailable = balanceResponse.available.find((b) => b.currency === "chf");
    let availableBalance = typeof chfAvailable?.amount === "number" ? chfAvailable.amount : 0;

    console.log("[api][cron][release-booking-payouts] balance", { availableBalance });

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
        payoutMethod: true,
        amount: true,
        currency: true,
        endDate: true,
        stripePaymentIntentId: true,
        stripeChargeId: true,
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

      if (booking.payoutMethod === "MANUAL") {
        skipped += 1;
        console.log("[api][cron][release-booking-payouts] skipping manual payout booking", { bookingId });
        continue;
      }

      try {
        const sitterProfile = await (prisma as any).sitterProfile.findUnique({
          where: { sitterId: String(booking.sitterId) },
          select: { stripeAccountId: true, stripeAccountStatus: true },
        });

        const destination = typeof sitterProfile?.stripeAccountId === "string" ? sitterProfile.stripeAccountId.trim() : "";
        const destinationStatus = typeof sitterProfile?.stripeAccountStatus === "string" ? sitterProfile.stripeAccountStatus.trim() : "";

        if (!destination || destinationStatus !== "ENABLED") {
          skipped += 1;
          console.warn("[api][cron][release-booking-payouts] sitter not ready", {
            bookingId,
            destination: destination || null,
            destinationStatus: destinationStatus || null,
          });
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
          chargeId: typeof booking.stripeChargeId === "string" ? booking.stripeChargeId : undefined,
        });

        if (!synced.ok) {
          if (synced.error === "RESOURCE_MISSING") {
            console.warn("[api][cron][release-booking-payouts] permanent failure, marking booking as skipped", {
              bookingId,
              paymentIntentId,
              reason: "payment intent does not exist (likely test-mode data)",
            });
            await (prisma as any).booking.update({
              where: { id: bookingId },
              data: {
                stripeTransferId: `SKIPPED:RESOURCE_MISSING:${paymentIntentId}`,
                payoutReleasedAt: new Date(),
                sitterPayoutAmount: 0,
              },
              select: { id: true },
            });
          }
          failed += 1;
          continue;
        }

        // chargeId from sync takes precedence; fall back to the DB value fetched above.
        const chargeId =
          (typeof synced.chargeId === "string" && synced.chargeId ? synced.chargeId : null) ||
          (typeof booking.stripeChargeId === "string" && booking.stripeChargeId ? booking.stripeChargeId : null);

        const payoutAmount = typeof synced.payoutAmount === "number" ? synced.payoutAmount : 0;
        const grossAmount = typeof booking.amount === "number" ? booking.amount : 0;
        const stripeFeeAmount = typeof synced.stripeFeeAmount === "number" ? synced.stripeFeeAmount : 0;
        const platformFeeAmount = typeof booking.platformFeeAmount === "number" ? booking.platformFeeAmount : 0;
        const netAmount = Math.max(0, grossAmount - stripeFeeAmount - platformFeeAmount);

        let transferAmount: number;

        if (chargeId) {
          // With source_transaction, Stripe transfers the earmarked funds from the specific
          // charge — no available balance required. Use the full payout amount.
          transferAmount = payoutAmount > 0 ? payoutAmount : netAmount;
        } else {
          // Fallback for bookings without a recorded chargeId: requires available balance.
          if (availableBalance <= 0) {
            skipped += 1;
            console.warn("[api][cron][release-booking-payouts] no available balance and no chargeId, will retry", {
              bookingId,
              payoutAmount,
              availableBalance,
            });
            continue;
          }
          transferAmount = payoutAmount <= availableBalance
            ? payoutAmount
            : netAmount <= availableBalance
              ? netAmount
              : 0;
        }

        console.log("[api][cron][release-booking-payouts] computed payout", {
          bookingId,
          grossAmount,
          stripeFeeAmount,
          platformFeeAmount,
          payoutAmount,
          netAmount,
          transferAmount,
          chargeId: chargeId || null,
          availableBalance,
          useSourceTransaction: Boolean(chargeId),
        });

        if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
          skipped += 1;
          console.warn("[api][cron][release-booking-payouts] insufficient balance, will retry next run", {
            bookingId,
            payoutAmount,
            netAmount,
            availableBalance,
          });
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
            grossAmount: String(grossAmount),
            stripeFeeAmount: String(stripeFeeAmount),
            platformFeeAmount: String(platformFeeAmount),
            payoutAmount: String(transferAmount),
          },
        };

        // source_transaction links the transfer to the specific charge, which means:
        // 1. Stripe can execute the transfer even before the charge fully settles.
        // 2. The money flow is auditable: charge → transfer → connected account.
        if (chargeId) {
          transferParams.source_transaction = chargeId;
        }

        const transfer = await stripe.transfers.create(transferParams, {
          idempotencyKey: `transfer:booking:${bookingId}:${paymentIntentId}:${transferAmount}`,
        });

        if (!transfer?.id) throw new Error("[api][cron][release-booking-payouts] missing transfer id after create");

        if (!chargeId) {
          availableBalance -= transferAmount;
        }

        await (prisma as any).booking.update({
          where: { id: bookingId },
          data: {
            stripeTransferId: transfer.id,
            payoutReleasedAt: new Date(),
            sitterPayoutAmount: transferAmount,
          },
          select: { id: true },
        });

        released += 1;
        console.log("[api][cron][release-booking-payouts] transfer created", {
          bookingId,
          transferId: transfer.id,
          transferAmount,
          destination,
          chargeId: chargeId || null,
        });
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
        availableBalance,
        asOf: now.toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][cron][release-booking-payouts] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
