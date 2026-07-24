import test from "node:test";
import assert from "node:assert/strict";

import { isLive, serviceStart, serviceEnd, serviceMidpoint } from "../../lib/serviceReport/currentService.ts";

const at = (iso: string) => new Date(iso);

test("hourly (Promenade) live window uses startAt/endAt", () => {
  const b = { status: "CONFIRMED", service: "Promenade", startAt: at("2026-07-24T14:00:00Z"), endAt: at("2026-07-24T16:00:00Z") };
  assert.equal(isLive(b, at("2026-07-24T15:00:00Z")), true);
  assert.equal(isLive(b, at("2026-07-24T13:59:00Z")), false, "before start");
  assert.equal(isLive(b, at("2026-07-24T16:01:00Z")), false, "after end");
  assert.equal(serviceMidpoint(b)?.toISOString(), "2026-07-24T15:00:00.000Z");
});

test("not CONFIRMED is never live", () => {
  const b = { status: "PAID", service: "Promenade", startAt: at("2026-07-24T14:00:00Z"), endAt: at("2026-07-24T16:00:00Z") };
  assert.equal(isLive(b, at("2026-07-24T15:00:00Z")), false);
});

test("daily (Pension) end extends to the Zurich end-of-day of endDate", () => {
  // endDate stored as UTC midnight of the checkout calendar day.
  const b = { status: "CONFIRMED", service: "Pension", startDate: at("2026-07-20T00:00:00Z"), endDate: at("2026-07-24T00:00:00Z") };
  // Afternoon of the checkout day is still within the stay (end-of-day Zurich).
  assert.equal(isLive(b, at("2026-07-24T15:00:00Z")), true);
  // A day after checkout is over.
  assert.equal(isLive(b, at("2026-07-25T15:00:00Z")), false);
  assert.equal(serviceStart(b)?.toISOString(), "2026-07-20T00:00:00.000Z");
  assert.ok((serviceEnd(b)?.getTime() ?? 0) > at("2026-07-24T20:00:00Z").getTime(), "end is late on the checkout day");
});
