import test from "node:test";
import assert from "node:assert/strict";

import {
  PENDING_PAYMENT_RESUMABLE_HOURS,
  isPendingPaymentResumable,
  pendingPaymentResumableSince,
} from "../../lib/bookings/pendingPayment.ts";

test("PENDING_PAYMENT resumable window is 48h", () => {
  assert.equal(PENDING_PAYMENT_RESUMABLE_HOURS, 48);
});

test("a recent unpaid checkout is resumable (counts + shows as 'à payer')", () => {
  const now = new Date("2026-07-21T12:00:00Z");
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  assert.equal(isPendingPaymentResumable(twoHoursAgo, now), true);
  assert.equal(isPendingPaymentResumable(twoHoursAgo.toISOString(), now), true);
});

test("an abandoned/old unpaid checkout is NOT resumable (no phantom 'à payer')", () => {
  const now = new Date("2026-07-21T12:00:00Z");
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  // The founder's 12 abandoned checkouts (all >48h old) must NOT be counted.
  assert.equal(isPendingPaymentResumable(threeDaysAgo, now), false);
});

test("the cutoff is exactly 48h before now", () => {
  const now = new Date("2026-07-21T12:00:00Z");
  assert.equal(pendingPaymentResumableSince(now).getTime(), now.getTime() - 48 * 60 * 60 * 1000);
});

test("invalid createdAt is treated as not resumable", () => {
  assert.equal(isPendingPaymentResumable("not-a-date"), false);
});
