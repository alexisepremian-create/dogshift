// Stripe Connect manual transfer integration currently estimates Stripe processing fees
// and adds them on top of the booking price so the sitter receives exactly the
// displayed reservation amount.
//
// This estimate is intentionally simple & robust: percentage of the booking price
// with an optional minimum (covers the fixed-ish part of many Stripe pricing models).

export const STRIPE_PAYMENT_FEE_PERCENT_BPS = 330; // 3.30%
export const STRIPE_PAYMENT_FEE_MIN_CENTS = 25; // CHF 0.25

export function estimateStripePaymentFeeCents(priceCents: number, opts?: { percentBps?: number; minCents?: number }) {
  const percentBps = typeof opts?.percentBps === "number" && Number.isFinite(opts.percentBps) ? Math.max(0, Math.trunc(opts.percentBps)) : STRIPE_PAYMENT_FEE_PERCENT_BPS;
  const minCents = typeof opts?.minCents === "number" && Number.isFinite(opts.minCents) ? Math.max(0, Math.trunc(opts.minCents)) : STRIPE_PAYMENT_FEE_MIN_CENTS;

  if (!Number.isFinite(priceCents) || priceCents <= 0) return 0;

  // Use ceil to avoid under-estimating fees.
  const feeFromPercent = Math.ceil((priceCents * percentBps) / 10000);
  return Math.max(minCents, feeFromPercent);
}

