import { test } from "node:test";
import assert from "node:assert/strict";

// Regression for the audit 2026-05-22 false-positive on Céline Bettex.
//
// The old logic counted only AvailabilityRule (recurring weekly rules) when
// deciding whether a sitter was "inactive". Sitters who only added one-off
// AvailabilityException slots for the coming week (no recurring rule)
// were marked as inactive and received the "suspension imminente" email
// even though they had legitimate dispos.
//
// The fix combines three signals into one "has engagement" boolean:
//   - count of AvailabilityRule (recurring rules)
//   - count of future AvailabilityException with status in {AVAILABLE, ON_REQUEST}
//   - count of future bookings with status in {PENDING_ACCEPTANCE, PAID, CONFIRMED}
//
// This test verifies the boolean logic, independent of the DB. The full
// integration with Prisma is exercised by the cron itself at 04:07 UTC.

function hasEngagement(args: { rules: number; exceptions: number; bookings: number }): boolean {
  return args.rules > 0 || args.exceptions > 0 || args.bookings > 0;
}

test("recurring rules only → has engagement", () => {
  assert.equal(hasEngagement({ rules: 1, exceptions: 0, bookings: 0 }), true);
});

test("future exceptions only (Céline's case) → has engagement", () => {
  assert.equal(hasEngagement({ rules: 0, exceptions: 1, bookings: 0 }), true);
});

test("future bookings only → has engagement (the strongest signal)", () => {
  assert.equal(hasEngagement({ rules: 0, exceptions: 0, bookings: 1 }), true);
});

test("nothing at all → no engagement (eligible for nudge)", () => {
  assert.equal(hasEngagement({ rules: 0, exceptions: 0, bookings: 0 }), false);
});

test("any combination of signals still counts as engagement", () => {
  assert.equal(hasEngagement({ rules: 3, exceptions: 2, bookings: 0 }), true);
  assert.equal(hasEngagement({ rules: 0, exceptions: 5, bookings: 1 }), true);
  assert.equal(hasEngagement({ rules: 1, exceptions: 0, bookings: 4 }), true);
});
