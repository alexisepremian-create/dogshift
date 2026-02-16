import test from "node:test";
import assert from "node:assert/strict";

import { computeMultiDayStatusIndexed, computeMultiDayStatusNaive } from "../../lib/availability/dayStatusMulti.ts";

function addDaysIso(iso: string, deltaDays: number) {
  const dt = new Date(`${iso}T12:00:00Z`);
  const next = new Date(dt.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

test("day-status/multi: indexed implementation matches naive (14 days, 3 services)", () => {
  const sitterId = "s-1";
  const from = "2026-02-02";
  const dates = Array.from({ length: 14 }).map((_, i) => addDaysIso(from, i));
  const now = new Date("2026-02-01T10:00:00Z");

  const allRules = [
    // PROMENADE: weekdays 09:00-12:00 available
    ...[1, 2, 3, 4, 5].map((dow) => ({ sitterId, serviceType: "PROMENADE", dayOfWeek: dow, startMin: 9 * 60, endMin: 12 * 60, status: "AVAILABLE" })),
    // DOGSITTING: weekdays 10:00-18:00 on request
    ...[1, 2, 3, 4, 5].map((dow) => ({ sitterId, serviceType: "DOGSITTING", dayOfWeek: dow, startMin: 10 * 60, endMin: 18 * 60, status: "ON_REQUEST" })),
    // PENSION: everyday check-in window available
    ...[0, 1, 2, 3, 4, 5, 6].map((dow) => ({ sitterId, serviceType: "PENSION", dayOfWeek: dow, startMin: 8 * 60, endMin: 19 * 60, status: "AVAILABLE" })),
  ];

  const allExceptions = [
    // One day fully unavailable for PROMENADE
    { sitterId, serviceType: "PROMENADE", date: dates[3], startMin: 0, endMin: 24 * 60, status: "UNAVAILABLE" },
    // One day dogsitting available override
    { sitterId, serviceType: "DOGSITTING", date: dates[5], startMin: 10 * 60, endMin: 18 * 60, status: "AVAILABLE" },
  ];

  const allBookings = [
    // Hard block overlaps multiple days
    {
      status: "CONFIRMED",
      createdAt: new Date("2026-02-01T09:00:00Z"),
      startAt: new Date(`${dates[6]}T10:00:00+01:00`),
      endAt: new Date(`${dates[7]}T10:00:00+01:00`),
    },
    // Soft block (within TTL)
    {
      status: "PENDING_ACCEPTANCE",
      createdAt: new Date("2026-02-01T12:00:00Z"),
      startAt: new Date(`${dates[9]}T10:00:00+01:00`),
      endAt: new Date(`${dates[9]}T11:00:00+01:00`),
    },
  ];

  const allConfigs = [
    { sitterId, serviceType: "PROMENADE", enabled: true, slotStepMin: 30, minDurationMin: 30, maxDurationMin: 120, leadTimeMin: 120, bufferBeforeMin: 15, bufferAfterMin: 15, overnightRequired: false, checkInStartMin: null, checkInEndMin: null, checkOutStartMin: null, checkOutEndMin: null },
    { sitterId, serviceType: "DOGSITTING", enabled: true, slotStepMin: 60, minDurationMin: 120, maxDurationMin: 720, leadTimeMin: 180, bufferBeforeMin: 0, bufferAfterMin: 0, overnightRequired: false, checkInStartMin: null, checkInEndMin: null, checkOutStartMin: null, checkOutEndMin: null },
    { sitterId, serviceType: "PENSION", enabled: true, slotStepMin: 60, minDurationMin: 60, maxDurationMin: 24 * 60, leadTimeMin: 24 * 60, bufferBeforeMin: 0, bufferAfterMin: 0, overnightRequired: true, checkInStartMin: 8 * 60, checkInEndMin: 19 * 60, checkOutStartMin: 8 * 60, checkOutEndMin: 12 * 60 },
  ];

  const naive = computeMultiDayStatusNaive({ sitterId, dates, now, allRules, allExceptions, allBookings, allConfigs });
  const indexed = computeMultiDayStatusIndexed({ sitterId, dates, now, allRules, allExceptions, allBookings, allConfigs }).days;

  assert.deepEqual(indexed, naive);
});
