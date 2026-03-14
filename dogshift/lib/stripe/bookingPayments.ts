import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function syncBookingPaymentDetails(params: {
  bookingId: string;
  paymentIntentId?: string;
  sessionId?: string;
  chargeId?: string;
}) {
  const bookingId = normalizeString(params.bookingId);
  const paymentIntentId = normalizeString(params.paymentIntentId);
  const explicitChargeId = normalizeString(params.chargeId);
  const sessionId = normalizeString(params.sessionId);

  if (!bookingId) return { ok: false as const, error: "INVALID_BOOKING_ID" as const };

  let intent: Stripe.PaymentIntent | null = null;
  let charge: Stripe.Charge | null = null;
  let chargeId = explicitChargeId;
  let stripeFeeAmount = 0;

  try {
    if (paymentIntentId) {
      intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
    }

    if (intent) {
      const latestCharge =
        typeof intent.latest_charge === "object" && intent.latest_charge && "id" in intent.latest_charge
          ? (intent.latest_charge as Stripe.Charge)
          : null;
      charge = latestCharge ?? null;
    }

    if (!charge && paymentIntentId) {
      const charges = await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1, expand: ["data.balance_transaction"] as any });
      charge = Array.isArray(charges.data) ? (charges.data[0] ?? null) : null;
    }

    if (!charge && chargeId) {
      charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
    }

    if (charge && typeof charge.id === "string") {
      chargeId = charge.id;
      const balanceTransaction =
        typeof charge.balance_transaction === "object" && charge.balance_transaction && "fee" in charge.balance_transaction
          ? charge.balance_transaction
          : null;
      stripeFeeAmount = typeof balanceTransaction?.fee === "number" ? balanceTransaction.fee : 0;
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: { id: true, amount: true, platformFeeAmount: true },
    });

    if (!booking) return { ok: false as const, error: "NOT_FOUND" as const };

    const grossAmount = typeof booking.amount === "number" ? booking.amount : 0;
    const platformFeeAmount = typeof booking.platformFeeAmount === "number" ? booking.platformFeeAmount : 0;
    const payoutAmount = Math.max(0, grossAmount - stripeFeeAmount - platformFeeAmount);

    await (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : null),
        ...(sessionId ? { stripeSessionId: sessionId } : null),
        ...(chargeId ? { stripeChargeId: chargeId } : null),
        stripeApplicationFeeAmount: platformFeeAmount,
        stripeProcessingFeeAmount: stripeFeeAmount,
        sitterPayoutAmount: payoutAmount,
      },
      select: { id: true },
    });

    return {
      ok: true as const,
      chargeId: chargeId || null,
      stripeFeeAmount,
      payoutAmount,
    };
  } catch (err) {
    console.error("[stripe][bookingPayments] syncBookingPaymentDetails failed", {
      bookingId,
      paymentIntentId: paymentIntentId || null,
      chargeId: chargeId || null,
      err,
    });
    return { ok: false as const, error: "SYNC_FAILED" as const };
  }
}
