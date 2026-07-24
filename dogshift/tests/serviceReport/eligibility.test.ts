import test from "node:test";
import assert from "node:assert/strict";

import { canSendReport, canEditReport } from "../../lib/serviceReport/eligibility.ts";

const at = (iso: string) => new Date(iso);
const base = {
  sitterId: "sit_1",
  status: "CONFIRMED",
  service: "Promenade",
  startAt: at("2026-07-24T14:00:00Z"),
  endAt: at("2026-07-24T16:00:00Z"),
};

test("canSendReport: only the owning sitter", () => {
  assert.deepEqual(canSendReport(base, "someone_else", at("2026-07-24T15:00:00Z")), { ok: false, reason: "FORBIDDEN" });
  assert.deepEqual(canSendReport(base, null, at("2026-07-24T15:00:00Z")), { ok: false, reason: "FORBIDDEN" });
});

test("canSendReport: must be CONFIRMED and started", () => {
  assert.deepEqual(canSendReport({ ...base, status: "PAID" }, "sit_1", at("2026-07-24T15:00:00Z")), { ok: false, reason: "NOT_CONFIRMED" });
  assert.deepEqual(canSendReport(base, "sit_1", at("2026-07-24T13:00:00Z")), { ok: false, reason: "NOT_STARTED" });
  assert.deepEqual(canSendReport(base, "sit_1", at("2026-07-24T15:00:00Z")), { ok: true });
  assert.deepEqual(canSendReport(base, "sit_1", at("2026-07-24T18:00:00Z")), { ok: true }, "after end still ok to send");
});

test("canEditReport: CONFIRMED + owner, even before start", () => {
  assert.deepEqual(canEditReport({ sitterId: "sit_1", status: "CONFIRMED" }, "sit_1"), { ok: true });
  assert.deepEqual(canEditReport({ sitterId: "sit_1", status: "PENDING_ACCEPTANCE" }, "sit_1"), { ok: false, reason: "NOT_CONFIRMED" });
  assert.deepEqual(canEditReport({ sitterId: "sit_1", status: "CONFIRMED" }, "other"), { ok: false, reason: "FORBIDDEN" });
});
