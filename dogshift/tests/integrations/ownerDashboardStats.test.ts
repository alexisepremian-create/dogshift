import test from "node:test";
import assert from "node:assert/strict";

import { DASHBOARD_UPCOMING_BOOKING_STATUSES } from "../../lib/account/dashboardStats.ts";

test("owner dashboard 'prochaine réservation' excludes unpaid bookings", () => {
  const set = new Set<string>(DASHBOARD_UPCOMING_BOOKING_STATUSES);
  // Unpaid drafts / abandoned checkouts must NOT show as a next reservation.
  assert.equal(set.has("PENDING_PAYMENT"), false);
  assert.equal(set.has("DRAFT"), false);
  // Real accepted/paid/confirmed bookings qualify.
  assert.equal(set.has("CONFIRMED"), true);
  assert.equal(set.has("PENDING_ACCEPTANCE"), true);
  assert.equal(set.has("PAID"), true);
});
