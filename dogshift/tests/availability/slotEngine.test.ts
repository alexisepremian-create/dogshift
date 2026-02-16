import test from "node:test";
import assert from "node:assert/strict";

import { computeDaySlots, dayOfWeekForZurichDate, type DaySlot } from "../../lib/availability/slotEngine.ts";

type Rule = {
  sitterId: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST";
};

type Exception = {
  sitterId: string;
  date: Date;
  startMin: number;
  endMin: number;
  status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
};

type Booking = {
  status: string;
  createdAt: Date;
  startAt?: Date | null;
  endAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
};

type Config = {
  sitterId: string;
  serviceType: "PROMENADE" | "DOGSITTING";
  enabled: boolean;
  slotStepMin: number;
  minDurationMin: number;
  maxDurationMin: number;
  leadTimeMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  overnightRequired: boolean;
  checkInStartMin: number | null;
  checkInEndMin: number | null;
  checkOutStartMin: number | null;
  checkOutEndMin: number | null;
};

function slotAt(slots: DaySlot[], startMin: number) {
  return slots.find((s) => s.startMin === startMin) ?? null;
}

function cetDate(dateIso: string, hh: number, mm: number) {
  const h = String(hh).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  return new Date(`${dateIso}T${h}:${m}:00+01:00`);
}

test("dayOfWeekForZurichDate is stable around DST", () => {
  assert.equal(dayOfWeekForZurichDate("2026-03-28"), 6); // Sat
  assert.equal(dayOfWeekForZurichDate("2026-03-29"), 0); // Sun (DST start in Zurich)
  assert.equal(dayOfWeekForZurichDate("2026-10-25"), 0); // Sun (DST end)
});

test("Rules 09:00-12:00 step 30 minDuration 30 generate expected slots", () => {
  const date = "2026-02-16";
  const now = new Date("2026-02-16T00:00:00Z");
  const slots = computeDaySlots({
    date,
    serviceType: "PROMENADE",
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [],
    config: {
      sitterId: "s-1",
      serviceType: "PROMENADE",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 120,
      leadTimeMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
  });

  assert.equal(slots.length, 6);
  assert.equal(slots[0].startMin, 9 * 60);
  assert.equal(slots[0].endMin, 9 * 60 + 30);
  assert.equal(slots[5].startMin, 11 * 60 + 30);
});

test("Exceptions override rules: UNAVAILABLE 10:00-11:00 marks slots as UNAVAILABLE with exception reason", () => {
  const date = "2026-02-16";
  const now = new Date("2026-02-16T00:00:00Z");

  const slots = computeDaySlots({
    date,
    serviceType: "PROMENADE",
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [
      {
        sitterId: "s-1",
        date: new Date("2026-02-16T00:00:00Z"),
        startMin: 10 * 60,
        endMin: 11 * 60,
        status: "UNAVAILABLE",
      } satisfies Exception,
    ],
    bookings: [],
    config: {
      sitterId: "s-1",
      serviceType: "PROMENADE",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 120,
      leadTimeMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
  });

  const s1000 = slotAt(slots, 10 * 60);
  const s1030 = slotAt(slots, 10 * 60 + 30);
  assert.ok(s1000);
  assert.ok(s1030);
  assert.equal(s1000.status, "UNAVAILABLE");
  assert.equal(s1000.reason, "exception_unavailable");
  assert.equal(s1030.status, "UNAVAILABLE");
});

test("Booking CONFIRMED hard-blocks overlapping slots (no buffer)", () => {
  const date = "2026-02-16";
  const now = new Date("2026-02-16T00:00:00Z");

  const slots = computeDaySlots({
    date,
    serviceType: "PROMENADE",
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 11 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [
      {
        status: "CONFIRMED",
        createdAt: new Date("2026-02-15T23:00:00Z"),
        startAt: cetDate("2026-02-16", 9, 30),
        endAt: cetDate("2026-02-16", 10, 30),
      } satisfies Booking,
    ],
    config: {
      sitterId: "s-1",
      serviceType: "PROMENADE",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 120,
      leadTimeMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
  });

  assert.equal(slotAt(slots, 9 * 60 + 30)?.status, "UNAVAILABLE");
  assert.equal(slotAt(slots, 9 * 60 + 30)?.reason, "booking_confirmed_overlap");
  assert.equal(slotAt(slots, 10 * 60)?.status, "UNAVAILABLE");
});

test("Booking PENDING_PAYMENT soft-blocks within TTL, ignored after TTL", () => {
  const date = "2026-02-16";
  const now = cetDate("2026-02-16", 8, 0);

  const base = {
    date,
    serviceType: "PROMENADE" as const,
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 10 * 60 + 30, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    config: {
      sitterId: "s-1",
      serviceType: "PROMENADE",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 120,
      leadTimeMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
  };

  const withinTtl = computeDaySlots({
    ...base,
    bookings: [
      {
        status: "PENDING_PAYMENT",
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
        startAt: cetDate("2026-02-16", 9, 0),
        endAt: cetDate("2026-02-16", 9, 30),
      } satisfies Booking,
    ],
  });
  assert.equal(slotAt(withinTtl, 9 * 60)?.status, "ON_REQUEST");
  assert.equal(slotAt(withinTtl, 9 * 60)?.reason, "booking_pending_payment_overlap");

  const expired = computeDaySlots({
    ...base,
    bookings: [
      {
        status: "PENDING_PAYMENT",
        createdAt: new Date(now.getTime() - 40 * 60 * 1000),
        startAt: cetDate("2026-02-16", 9, 0),
        endAt: cetDate("2026-02-16", 9, 30),
      } satisfies Booking,
    ],
  });
  assert.equal(slotAt(expired, 9 * 60)?.status, "AVAILABLE");
});

test("Booking PENDING_ACCEPTANCE soft-blocks within TTL, ignored after TTL", () => {
  const date = "2026-02-16";
  const now = cetDate("2026-02-16", 8, 0);

  const base = {
    date,
    serviceType: "PROMENADE" as const,
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 10 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    config: {
      sitterId: "s-1",
      serviceType: "PROMENADE",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 120,
      leadTimeMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
  };

  const withinTtl = computeDaySlots({
    ...base,
    bookings: [
      {
        status: "PENDING_ACCEPTANCE",
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        startAt: cetDate("2026-02-16", 9, 0),
        endAt: cetDate("2026-02-16", 9, 30),
      } satisfies Booking,
    ],
  });
  assert.equal(slotAt(withinTtl, 9 * 60)?.status, "ON_REQUEST");
  assert.equal(slotAt(withinTtl, 9 * 60)?.reason, "booking_pending_acceptance_overlap");

  const expired = computeDaySlots({
    ...base,
    bookings: [
      {
        status: "PENDING_ACCEPTANCE",
        createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000),
        startAt: cetDate("2026-02-16", 9, 0),
        endAt: cetDate("2026-02-16", 9, 30),
      } satisfies Booking,
    ],
  });
  assert.equal(slotAt(expired, 9 * 60)?.status, "AVAILABLE");
});

test("Buffers extend hard-blocked windows", () => {
  const date = "2026-02-16";
  const now = new Date("2026-02-16T00:00:00Z");

  const slots = computeDaySlots({
    date,
    serviceType: "PROMENADE",
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 11 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [
      {
        status: "CONFIRMED",
        createdAt: new Date("2026-02-15T23:00:00Z"),
        startAt: cetDate("2026-02-16", 10, 0),
        endAt: cetDate("2026-02-16", 10, 30),
      } satisfies Booking,
    ],
    config: {
      sitterId: "s-1",
      serviceType: "PROMENADE",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 120,
      leadTimeMin: 0,
      bufferBeforeMin: 15,
      bufferAfterMin: 15,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
  });

  // Booking window is 10:00-10:30, buffers expand to 09:45-10:45. So 09:30 slot overlaps buffered window.
  assert.equal(slotAt(slots, 9 * 60 + 30)?.status, "UNAVAILABLE");
  assert.equal(slotAt(slots, 10 * 60)?.status, "UNAVAILABLE");
  assert.equal(slotAt(slots, 10 * 60 + 30)?.status, "UNAVAILABLE");
});

test("Lead time blocks slots too close to now", () => {
  const date = "2026-02-16";
  const now = cetDate("2026-02-16", 8, 0);

  const slots = computeDaySlots({
    date,
    serviceType: "PROMENADE",
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [],
    config: {
      sitterId: "s-1",
      serviceType: "PROMENADE",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 120,
      leadTimeMin: 120,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
  });

  assert.equal(slotAt(slots, 9 * 60)?.status, "UNAVAILABLE");
  assert.equal(slotAt(slots, 9 * 60)?.reason, "lead_time");
  assert.equal(slotAt(slots, 10 * 60)?.status, "AVAILABLE");
});

test("durationMin override: longer duration yields fewer slots", () => {
  const date = "2026-02-16";
  const now = new Date("2026-02-16T00:00:00Z");
  const config = {
    sitterId: "s-1",
    serviceType: "DOGSITTING",
    enabled: true,
    slotStepMin: 30,
    minDurationMin: 30,
    maxDurationMin: 240,
    leadTimeMin: 0,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    overnightRequired: false,
    checkInStartMin: null,
    checkInEndMin: null,
    checkOutStartMin: null,
    checkOutEndMin: null,
  } satisfies Config;

  const base = {
    date,
    serviceType: "DOGSITTING" as const,
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [],
    config,
  };

  const shortSlots = computeDaySlots({ ...base, durationMin: 30 });
  const longSlots = computeDaySlots({ ...base, durationMin: 60 });

  assert.equal(shortSlots.length, 6);
  assert.equal(longSlots.length, 5);
  assert.equal(longSlots[0].endMin - longSlots[0].startMin, 60);

  const shortAvailable = shortSlots.filter((s) => s.status === "AVAILABLE").length;
  const longAvailable = longSlots.filter((s) => s.status === "AVAILABLE").length;
  assert.equal(shortAvailable, 6);
  assert.equal(longAvailable, 5);
  assert.equal(slotAt(longSlots, 11 * 60 + 30), null);
});

test("durationMin override: hard booking overlap blocks long slot", () => {
  const date = "2026-02-16";
  const now = new Date("2026-02-16T00:00:00Z");

  const slots = computeDaySlots({
    date,
    serviceType: "DOGSITTING",
    now,
    rules: [{ sitterId: "s-1", dayOfWeek: 1, startMin: 9 * 60, endMin: 12 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [
      {
        status: "CONFIRMED",
        createdAt: new Date("2026-02-15T23:00:00Z"),
        startAt: cetDate("2026-02-16", 9, 45),
        endAt: cetDate("2026-02-16", 10, 15),
      } satisfies Booking,
    ],
    config: {
      sitterId: "s-1",
      serviceType: "DOGSITTING",
      enabled: true,
      slotStepMin: 30,
      minDurationMin: 30,
      maxDurationMin: 240,
      leadTimeMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      overnightRequired: false,
      checkInStartMin: null,
      checkInEndMin: null,
      checkOutStartMin: null,
      checkOutEndMin: null,
    } satisfies Config,
    durationMin: 60,
  });

  // Slot 09:30-10:30 overlaps booking 09:45-10:15.
  assert.equal(slotAt(slots, 9 * 60 + 30)?.status, "UNAVAILABLE");
  assert.equal(slotAt(slots, 9 * 60 + 30)?.reason, "booking_confirmed_overlap");
});
