/**
 * A PENDING_PAYMENT booking is an unpaid checkout (the owner started a booking
 * but never completed the Stripe payment). It's only a real "réservation à payer"
 * — worth nudging on the dashboard AND showing in the list — while the checkout
 * can still be resumed. Past this window the Stripe session is abandoned/expired,
 * so surfacing it is a dead-end.
 *
 * Bug it fixes: the dashboard showed "12 réservations à payer" but clicking led to
 * an EMPTY list — all 12 were old abandoned checkouts that no booking view could
 * display. The dashboard COUNT and the bookings VIEW must use this same rule so
 * the badge and the list always agree (founder: "il faut que ce soit synchro").
 *
 * Kept at 48h to match the dashboard's existing "stale payment" threshold.
 */
export const PENDING_PAYMENT_RESUMABLE_HOURS = 48;

/** The cutoff `createdAt` below which a PENDING_PAYMENT booking is abandoned. */
export function pendingPaymentResumableSince(now: Date = new Date()): Date {
  return new Date(now.getTime() - PENDING_PAYMENT_RESUMABLE_HOURS * 60 * 60 * 1000);
}

/** True while an unpaid checkout is recent enough to still be resumed/paid. */
export function isPendingPaymentResumable(createdAt: string | Date, now: Date = new Date()): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() >= pendingPaymentResumableSince(now).getTime();
}
