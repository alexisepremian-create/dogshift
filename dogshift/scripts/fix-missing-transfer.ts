/**
 * One-off script to create the missing Stripe transfer for a specific booking.
 *
 * Usage:
 *   node --experimental-strip-types scripts/fix-missing-transfer.ts
 *
 * Requires .env.local to be loaded (DATABASE_URL, STRIPE_SECRET_KEY).
 * Dry-run by default; set DRY_RUN=false to actually create the transfer.
 *
 * Known missed transfer as of 2026-04-17:
 *   PaymentIntent : pi_3TM0K3EpLDnT2sHn02rLXI4g
 *   Charge        : ch_3TM0K3EpLDnT2sHn0obRBYwd
 *   Booking       : cmny8es5o0001l104nc7lwk7m
 *   Sitter account: acct_1TJ9EcRTzVkGqj9u
 */

import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.env.DRY_RUN !== "false";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2024-06-20" });
const prisma = new PrismaClient();

const BOOKING_ID = "cmny8es5o0001l104nc7lwk7m";

async function main() {
  console.log(`[fix-missing-transfer] DRY_RUN=${DRY_RUN}`);

  const booking = await (prisma as any).booking.findUnique({
    where: { id: BOOKING_ID },
    select: {
      id: true,
      sitterId: true,
      amount: true,
      currency: true,
      platformFeeAmount: true,
      status: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
      stripeTransferId: true,
      payoutReleasedAt: true,
      endDate: true,
    },
  });

  if (!booking) throw new Error(`Booking ${BOOKING_ID} not found`);
  console.log("[fix-missing-transfer] booking", booking);

  if (booking.stripeTransferId) {
    console.log("[fix-missing-transfer] transfer already exists:", booking.stripeTransferId);
    process.exit(0);
  }

  const sitterProfile = await (prisma as any).sitterProfile.findUnique({
    where: { sitterId: String(booking.sitterId) },
    select: { stripeAccountId: true, stripeAccountStatus: true },
  });

  if (!sitterProfile?.stripeAccountId) throw new Error("Sitter has no Stripe account");
  console.log("[fix-missing-transfer] sitter profile", sitterProfile);

  const paymentIntentId = booking.stripePaymentIntentId ?? "pi_3TM0K3EpLDnT2sHn02rLXI4g";
  const chargeId = booking.stripeChargeId ?? "ch_3TM0K3EpLDnT2sHn0obRBYwd";

  // Fetch real Stripe fee from the charge balance transaction.
  const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  const balanceTx = typeof charge.balance_transaction === "object" && charge.balance_transaction
    ? charge.balance_transaction as { fee: number }
    : null;
  const stripeFee = balanceTx?.fee ?? 0;

  const grossAmount = booking.amount;
  const platformFee = booking.platformFeeAmount ?? 0;
  const payoutAmount = Math.max(0, grossAmount - platformFee);

  console.log("[fix-missing-transfer] amounts", {
    grossAmount,
    stripeFee,
    platformFee,
    payoutAmount,
    chargeId,
    destination: sitterProfile.stripeAccountId,
  });

  if (DRY_RUN) {
    console.log("[fix-missing-transfer] DRY RUN — would create transfer:", {
      amount: payoutAmount,
      currency: booking.currency ?? "chf",
      destination: sitterProfile.stripeAccountId,
      source_transaction: chargeId,
      transfer_group: `booking:${BOOKING_ID}`,
    });
    return;
  }

  const transfer = await stripe.transfers.create(
    {
      amount: payoutAmount,
      currency: String(booking.currency ?? "chf").toLowerCase(),
      destination: sitterProfile.stripeAccountId,
      source_transaction: chargeId,
      transfer_group: `booking:${BOOKING_ID}`,
      metadata: {
        bookingId: BOOKING_ID,
        sitterId: String(booking.sitterId),
        paymentIntentId,
        fixedBy: "fix-missing-transfer-script",
        grossAmount: String(grossAmount),
        stripeFee: String(stripeFee),
        platformFee: String(platformFee),
        payoutAmount: String(payoutAmount),
      },
    },
    {
      idempotencyKey: `transfer:booking:${BOOKING_ID}:${paymentIntentId}:${payoutAmount}`,
    }
  );

  console.log("[fix-missing-transfer] transfer created:", transfer.id);

  await (prisma as any).booking.update({
    where: { id: BOOKING_ID },
    data: {
      stripeTransferId: transfer.id,
      payoutReleasedAt: new Date(),
      sitterPayoutAmount: payoutAmount,
    },
    select: { id: true },
  });

  console.log("[fix-missing-transfer] booking updated. Done.");
}

main()
  .catch((err) => {
    console.error("[fix-missing-transfer] FAILED", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
