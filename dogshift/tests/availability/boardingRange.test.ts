import test from "node:test";
import assert from "node:assert/strict";

import { evaluateBoardingRangeFromData, SERVICE_DEFAULTS } from "../../lib/availability/slotEngine.ts";

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
  startAt: Date;
  endAt: Date;
};

function cetDate(dateIso: string, hh: number, mm: number) {
  const h = String(hh).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  return new Date(`${dateIso}T${h}:${m}:00+01:00`);
}

test("checkBoardingRange: range containing CONFIRMED booking makes range UNAVAILABLE", () => {
  const sitterId = "s-1";
  const startDate = "2026-02-16";
  const endDate = "2026-02-17";
  const now = cetDate("2026-02-10", 8, 0);

  const res = evaluateBoardingRangeFromData({
    sitterId,
    startDate,
    endDate,
    now,
    rules: [{ sitterId, dayOfWeek: 1, startMin: 8 * 60, endMin: 19 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [
      {
        status: "CONFIRMED",
        createdAt: cetDate("2026-02-10", 7, 0),
        startAt: cetDate("2026-02-16", 10, 0),
        endAt: cetDate("2026-02-16", 12, 0),
      } satisfies Booking,
    ],
    config: { ...SERVICE_DEFAULTS.PENSION, sitterId },
  });

  assert.equal(res.status, "UNAVAILABLE");
  assert.ok(res.blockingDays?.some((d) => d.date === "2026-02-16"));
});

test("checkBoardingRange: PENDING_ACCEPTANCE within TTL makes range ON_REQUEST", () => {
  const sitterId = "s-1";
  const startDate = "2026-02-16";
  const endDate = "2026-02-17";
  const now = cetDate("2026-02-15", 8, 0);

  const res = evaluateBoardingRangeFromData({
    sitterId,
    startDate,
    endDate,
    now,
    rules: [{ sitterId, dayOfWeek: 1, startMin: 8 * 60, endMin: 19 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [
      {
        status: "PENDING_ACCEPTANCE",
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        startAt: cetDate("2026-02-16", 9, 0),
        endAt: cetDate("2026-02-16", 11, 0),
      } satisfies Booking,
    ],
    config: { ...SERVICE_DEFAULTS.PENSION, sitterId },
  });

  assert.equal(res.status, "ON_REQUEST");
  assert.ok(res.days.some((d) => d.status === "ON_REQUEST"));
});

test("checkBoardingRange: exception UNAVAILABLE on one day makes range UNAVAILABLE", () => {
  const sitterId = "s-1";
  const startDate = "2026-02-16";
  const endDate = "2026-02-17";
  const now = cetDate("2026-02-10", 8, 0);

  const res = evaluateBoardingRangeFromData({
    sitterId,
    startDate,
    endDate,
    now,
    rules: [{ sitterId, dayOfWeek: 1, startMin: 8 * 60, endMin: 19 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [
      {
        sitterId,
        date: new Date("2026-02-16"),
        startMin: 8 * 60,
        endMin: 19 * 60,
        status: "UNAVAILABLE",
      } satisfies Exception,
    ],
    bookings: [],
    config: { ...SERVICE_DEFAULTS.PENSION, sitterId },
  });

  assert.equal(res.status, "UNAVAILABLE");
  assert.ok(res.blockingDays?.some((d) => d.date === "2026-02-16"));
});

test("checkBoardingRange: leadTime applied on startDate makes range UNAVAILABLE when too close", () => {
  const sitterId = "s-1";
  const startDate = "2026-02-16";
  const endDate = "2026-02-17";
  const now = cetDate("2026-02-16", 7, 0);

  const config = { ...SERVICE_DEFAULTS.PENSION, sitterId, leadTimeMin: 24 * 60 };

  const res = evaluateBoardingRangeFromData({
    sitterId,
    startDate,
    endDate,
    now,
    rules: [{ sitterId, dayOfWeek: 1, startMin: 8 * 60, endMin: 19 * 60, status: "AVAILABLE" } satisfies Rule],
    exceptions: [],
    bookings: [],
    config,
  });

  assert.equal(res.status, "UNAVAILABLE");
  assert.ok(res.blockingDays?.some((d) => d.date === "2026-02-16"));
});
