import test from "node:test";
import assert from "node:assert/strict";

import { canOwnerArchiveOrDelete, isBookingPassed } from "../../lib/bookings/ownerBookingMutation.ts";

const NOW = new Date("2026-07-19T08:00:00.000Z");
const PAST = "2026-07-10T10:00:00.000Z";
const FUTURE = "2026-07-25T10:00:00.000Z";

test("isBookingPassed: uses the latest known end/start moment", () => {
  assert.equal(isBookingPassed({ endAt: PAST }, NOW), true);
  assert.equal(isBookingPassed({ endAt: FUTURE }, NOW), false);
  // Pension-style dates.
  assert.equal(isBookingPassed({ startDate: PAST, endDate: PAST }, NOW), true);
  assert.equal(isBookingPassed({ startDate: PAST, endDate: FUTURE }, NOW), false); // still running
  // No dates → treated as not passed (don't wrongly unlock).
  assert.equal(isBookingPassed({}, NOW), false);
});

test("canOwnerArchiveOrDelete: only an active CONFIRMED booking is blocked", () => {
  // Confirmed & upcoming → blocked.
  assert.equal(canOwnerArchiveOrDelete({ status: "CONFIRMED", endAt: FUTURE }, NOW), false);
  // Confirmed & passed → allowed.
  assert.equal(canOwnerArchiveOrDelete({ status: "CONFIRMED", endAt: PAST }, NOW), true);
  // Every non-confirmed status → allowed regardless of date.
  assert.equal(canOwnerArchiveOrDelete({ status: "PENDING_ACCEPTANCE", endAt: FUTURE }, NOW), true);
  assert.equal(canOwnerArchiveOrDelete({ status: "PAID", endAt: FUTURE }, NOW), true);
  assert.equal(canOwnerArchiveOrDelete({ status: "CANCELLED", endAt: FUTURE }, NOW), true);
  assert.equal(canOwnerArchiveOrDelete({ status: "REFUNDED", endAt: PAST }, NOW), true);
  // Confirmed with no dates → treated as active → blocked (safe default).
  assert.equal(canOwnerArchiveOrDelete({ status: "CONFIRMED" }, NOW), false);
});
