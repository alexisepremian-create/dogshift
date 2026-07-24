import test from "node:test";
import assert from "node:assert/strict";

import { selfieDue, reportDue, selfieKey, reportKey, zurichDateKey } from "../../lib/serviceReport/nudges.ts";

const at = (iso: string) => new Date(iso);
const TICK = 5 * 60 * 1000;

const hourly = {
  status: "CONFIRMED",
  service: "Promenade",
  startAt: at("2026-07-24T14:00:00Z"),
  endAt: at("2026-07-24T16:00:00Z"),
};

test("selfieDue (hourly): only from midpoint until end, and only when CONFIRMED", () => {
  assert.equal(selfieDue(hourly, at("2026-07-24T14:30:00Z"), TICK), false, "before midpoint");
  assert.equal(selfieDue(hourly, at("2026-07-24T15:00:00Z"), TICK), true, "at midpoint");
  assert.equal(selfieDue(hourly, at("2026-07-24T15:45:00Z"), TICK), true, "after midpoint, before end");
  assert.equal(selfieDue(hourly, at("2026-07-24T16:30:00Z"), TICK), false, "after end");
  assert.equal(selfieDue({ ...hourly, status: "PAID" }, at("2026-07-24T15:00:00Z"), TICK), false, "not confirmed");
});

test("reportDue (hourly): from end until the grace window closes", () => {
  assert.equal(reportDue(hourly, at("2026-07-24T15:59:00Z")), false, "before end");
  assert.equal(reportDue(hourly, at("2026-07-24T16:00:00Z")), true, "at end");
  assert.equal(reportDue(hourly, at("2026-07-24T21:00:00Z")), true, "within 6h grace");
  assert.equal(reportDue(hourly, at("2026-07-24T23:00:00Z")), false, "past 6h grace");
});

test("selfieDue (daily Pension): fires around 14:00 Zurich during the stay", () => {
  const daily = { status: "CONFIRMED", service: "Pension", startDate: at("2026-07-20T00:00:00Z"), endDate: at("2026-07-24T00:00:00Z") };
  // 14:0x Zurich in July (CEST = UTC+2) → 12:0x UTC.
  assert.equal(selfieDue(daily, at("2026-07-22T12:02:00Z"), TICK), true, "14:02 Zurich mid-stay");
  assert.equal(selfieDue(daily, at("2026-07-22T12:07:00Z"), TICK), false, "14:07 Zurich outside the tick window");
  assert.equal(selfieDue(daily, at("2026-07-22T09:02:00Z"), TICK), false, "11:02 Zurich, wrong hour");
});

test("idempotency keys: report is once-ever, selfie is per Zurich day", () => {
  assert.equal(reportKey("bk_1"), "serviceReportReminder:bk_1");
  const day = zurichDateKey(at("2026-07-24T15:00:00Z"));
  assert.equal(selfieKey("bk_1", at("2026-07-24T15:00:00Z")), `serviceReportSelfie:bk_1:${day}`);
  // A late-evening UTC instant still maps to the correct Zurich day.
  assert.equal(zurichDateKey(at("2026-07-24T23:30:00Z")), "2026-07-25");
});
