import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const BOOKING_HOLD_MS = 30 * 60 * 1000;
export const RESERVED_STATUSES = ["PENDING_PAYMENT", "PAYMENT_FAILED", "PENDING_ACCEPTANCE", "PAID", "CONFIRMED"] as const;

// Creation and payment preparation use the same per-sitter transaction lock.
export function withSitterBookingLock<T>(sitterId: string, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sitterId}, 0))::text`;
    return run(tx);
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function expireUnpaidBooking(tx: Prisma.TransactionClient, booking: {
  id: string; status: string; createdAt: Date; stripePaymentIntentId: string | null;
}, now = new Date()): Promise<boolean> {
  if (!["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(booking.status) || now.getTime() - booking.createdAt.getTime() < BOOKING_HOLD_MS) return false;
  if (booking.stripePaymentIntentId) {
    // Never release a slot while an old client secret could still charge a card.
    // A payment that is processing/succeeded, or a provider outage, keeps its slot.
    try {
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
      if (["succeeded", "processing", "requires_capture"].includes(intent.status)) return false;
      if (intent.status !== "canceled") {
        const canceled = await stripe.paymentIntents.cancel(intent.id);
        if (canceled.status !== "canceled") return false;
      }
    } catch { return false; }
  }
  const result = await tx.booking.updateMany({
    where: { id: booking.id, status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] } },
    data: { status: "CANCELLED" },
  });
  return result.count === 1;
}

export async function cancelUnpaidBooking(bookingId: string, userId: string) {
  const ref = await prisma.booking.findFirst({ where: { id: bookingId, userId }, select: { sitterId: true } });
  if (!ref) return { ok: false as const, error: "NOT_FOUND" };
  return withSitterBookingLock(ref.sitterId, async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || !["DRAFT", "PENDING_PAYMENT", "PAYMENT_FAILED"].includes(booking.status)) return { ok: false as const, error: "CANNOT_CANCEL_PAID" };
    if (booking.stripePaymentIntentId) {
      try {
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
        if (["succeeded", "processing", "requires_capture"].includes(intent.status)) return { ok: false as const, error: "PAYMENT_IN_PROGRESS" };
        if (intent.status !== "canceled" && (await stripe.paymentIntents.cancel(intent.id)).status !== "canceled") return { ok: false as const, error: "PAYMENT_RETRY_LATER" };
      } catch { return { ok: false as const, error: "PAYMENT_RETRY_LATER" }; }
    }
    const updated = await tx.booking.updateMany({ where: { id: bookingId, status: booking.status }, data: { status: "CANCELLED", canceledAt: new Date() } });
    return updated.count === 1 ? { ok: true as const, booking: { id: bookingId, status: "CANCELLED" } } : { ok: false as const, error: "INVALID_STATUS" };
  });
}
