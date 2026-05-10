import test from "node:test";
import assert from "node:assert/strict";

import { bookingServiceEndUtc, ownerBookingBlocksAccountDeletion } from "../../lib/bookings/bookingServiceEnd.ts";

test("bookingServiceEnd: Promenade uses end instant (endDate)", () => {
  const end = new Date("2026-02-21T12:15:00.000Z");
  assert.equal(
    bookingServiceEndUtc({ service: "Promenade", endDate: end, endAt: null })?.getTime(),
    end.getTime()
  );
});

test("ownerBookingBlocksAccountDeletion: CONFIRMED past Promenade does not block", () => {
  const now = new Date("2026-04-18T10:00:00.000Z");
  const booking = {
    status: "CONFIRMED",
    service: "Promenade",
    endDate: new Date("2026-02-21T12:15:00.000Z"),
    endAt: null,
    archivedAt: null,
  };
  assert.equal(ownerBookingBlocksAccountDeletion(booking, now), false);
});

test("ownerBookingBlocksAccountDeletion: CONFIRMED future Promenade blocks", () => {
  const now = new Date("2026-02-21T10:00:00.000Z");
  const booking = {
    status: "CONFIRMED",
    service: "Promenade",
    endDate: new Date("2026-02-21T12:15:00.000Z"),
    endAt: null,
    archivedAt: null,
  };
  assert.equal(ownerBookingBlocksAccountDeletion(booking, now), true);
});

test("ownerBookingBlocksAccountDeletion: PENDING_PAYMENT never blocks (unpaid checkout)", () => {
  const now = new Date("2026-04-18T10:00:00.000Z");
  const booking = {
    status: "PENDING_PAYMENT",
    service: "Promenade",
    endDate: new Date("2026-02-21T12:15:00.000Z"),
    endAt: null,
    archivedAt: null,
  };
  assert.equal(ownerBookingBlocksAccountDeletion(booking, now), false);
});

test("ownerBookingBlocksAccountDeletion: DRAFT never blocks", () => {
  const now = new Date("2026-04-18T10:00:00.000Z");
  const booking = {
    status: "DRAFT",
    service: "Promenade",
    endDate: new Date("2026-06-01T12:00:00.000Z"),
    endAt: null,
    archivedAt: null,
  };
  assert.equal(ownerBookingBlocksAccountDeletion(booking, now), false);
});

test("bookingServiceEnd: Garde extends to end of Zurich civil day of checkout", () => {
  const storedEnd = new Date("2026-02-21T00:00:00.000Z");
  const end = bookingServiceEndUtc({ service: "Garde", endDate: storedEnd, endAt: null });
  assert.ok(end);
  assert.ok(end!.getTime() > storedEnd.getTime());
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(end!);
  assert.equal(ymd, "2026-02-21");
});
