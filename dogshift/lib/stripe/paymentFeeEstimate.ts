// Stripe processing fee estimate: percentage + fixed part per transaction.
// Covers the worst-case domestic/international card fees (3.25% + 0.30 CHF).
// TWINT is cheaper (1.9% + 0.30) so this always leaves a small buffer.

export const STRIPE_PAYMENT_FEE_PERCENT_BPS = 325; // 3.25%
export const STRIPE_PAYMENT_FEE_FIXED_CENTS = 30; // CHF 0.30
export const STRIPE_PAYMENT_FEE_MIN_CENTS = 30; // CHF 0.30

export function estimateStripePaymentFeeCents(priceCents: number, opts?: { percentBps?: number; fixedCents?: number; minCents?: number }) {
  const percentBps = typeof opts?.percentBps === "number" && Number.isFinite(opts.percentBps) ? Math.max(0, Math.trunc(opts.percentBps)) : STRIPE_PAYMENT_FEE_PERCENT_BPS;
  const fixedCents = typeof opts?.fixedCents === "number" && Number.isFinite(opts.fixedCents) ? Math.max(0, Math.trunc(opts.fixedCents)) : STRIPE_PAYMENT_FEE_FIXED_CENTS;
  const minCents = typeof opts?.minCents === "number" && Number.isFinite(opts.minCents) ? Math.max(0, Math.trunc(opts.minCents)) : STRIPE_PAYMENT_FEE_MIN_CENTS;

  if (!Number.isFinite(priceCents) || priceCents <= 0) return 0;

  const fee = Math.ceil((priceCents * percentBps) / 10000) + fixedCents;
  return Math.max(minCents, fee);
}

