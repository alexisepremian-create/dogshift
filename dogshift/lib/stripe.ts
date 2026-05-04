/* eslint-disable @typescript-eslint/no-explicit-any */
import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) return stripeSingleton;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  stripeSingleton = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
  });
  return stripeSingleton;
}

// Backward-compatible export for existing imports.
// This stays lazy: Stripe is only initialized when a property is accessed.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const s = getStripe();
    return (s as any)[prop];
  },
});
