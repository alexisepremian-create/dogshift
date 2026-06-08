import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mergeServicesIntoHostJson,
  normalizeServicesToBoolRecord,
  toServicesArray,
  UI_SERVICE_LABELS,
} from "../../lib/sitter/serviceSync.ts";

// Regression for the Layer 2 fix shipped after the 2026-06-08 audit.
// The cron `profile-health-check` reported "Services proposés
// désynchronisés (UI vs base)" for 15 sitters because three write paths
// (PUT service-config, POST host/profile, the dashboard JSON blob) each
// wrote to a subset of the three sources of truth.
//
// `lib/sitter/serviceSync.ts` exposes pure helpers that normalize any
// shape we encounter in production to the canonical boolean record. The
// DB-touching `syncSitterServices()` function is wrapped in a Prisma
// transaction and covered by manual smoke tests in preview.

test("UI_SERVICE_LABELS contains the three expected entries in canonical order", () => {
  assert.deepEqual([...UI_SERVICE_LABELS], ["Promenade", "Garde", "Pension"]);
});

test("normalize: array of UI labels becomes a complete boolean record", () => {
  assert.deepEqual(
    normalizeServicesToBoolRecord(["Promenade", "Garde"]),
    { Promenade: true, Garde: true, Pension: false },
  );
});

test("normalize: boolean record passes through unchanged for known labels", () => {
  assert.deepEqual(
    normalizeServicesToBoolRecord({ Promenade: true, Garde: false, Pension: true }),
    { Promenade: true, Garde: false, Pension: true },
  );
});

test("normalize: missing keys default to false (not undefined)", () => {
  assert.deepEqual(
    normalizeServicesToBoolRecord({ Promenade: true }),
    { Promenade: true, Garde: false, Pension: false },
  );
});

test("normalize: array form ignores unknown labels and whitespace-only strings", () => {
  assert.deepEqual(
    normalizeServicesToBoolRecord(["Promenade", "Unknown", " ", "Garde"]),
    { Promenade: true, Garde: true, Pension: false },
  );
});

test("normalize: garbage input (null, number, missing) returns all-false record", () => {
  for (const v of [null, undefined, 42, "string", true]) {
    assert.deepEqual(
      normalizeServicesToBoolRecord(v),
      { Promenade: false, Garde: false, Pension: false },
      `garbage input ${JSON.stringify(v)} should normalize to all-false`,
    );
  }
});

test("normalize: bug-shape from old dashboard ({Promenade: 1, Garde: 0}) maps non-strict-true to false", () => {
  // Defensive : the schema accepts only `true` to enable. Truthy non-boolean
  // values (1, "true", etc.) are treated as disabled to avoid silently
  // re-enabling a service the user thought they had switched off.
  assert.deepEqual(
    normalizeServicesToBoolRecord({ Promenade: 1, Garde: "true", Pension: true }),
    { Promenade: false, Garde: false, Pension: true },
  );
});

test("toServicesArray: only includes labels with explicit true", () => {
  assert.deepEqual(
    toServicesArray({ Promenade: true, Garde: false, Pension: true }),
    ["Promenade", "Pension"],
  );
});

test("toServicesArray: preserves the canonical label order regardless of input order", () => {
  // The boolean record is theoretically unordered but Object.entries returns
  // insertion order. Our helper iterates UI_SERVICE_LABELS to guarantee a
  // stable canonical order so the column doesn't churn between identical
  // states.
  const a = toServicesArray({ Pension: true, Garde: true, Promenade: true });
  const b = toServicesArray({ Promenade: true, Garde: true, Pension: true });
  assert.deepEqual(a, b);
  assert.deepEqual(a, ["Promenade", "Garde", "Pension"]);
});

test("mergeServicesIntoHostJson: preserves unrelated fields and stamps updatedAt", () => {
  const before = JSON.stringify({
    firstName: "Sysy",
    city: "Lutry",
    bio: "Bio",
    services: { Promenade: true, Garde: false, Pension: false },
    pricing: { Promenade: 22 },
    updatedAt: "2026-05-01T10:00:00.000Z",
  });

  const merged = mergeServicesIntoHostJson(before, {
    Promenade: true,
    Garde: true,
    Pension: false,
  });

  assert.equal(merged.firstName, "Sysy");
  assert.equal(merged.city, "Lutry");
  assert.equal(merged.bio, "Bio");
  assert.deepEqual(merged.pricing, { Promenade: 22 });
  assert.deepEqual(merged.services, { Promenade: true, Garde: true, Pension: false });
  assert.ok(
    typeof merged.updatedAt === "string" && merged.updatedAt !== "2026-05-01T10:00:00.000Z",
    "updatedAt must be refreshed when we touch the JSON",
  );
});

test("mergeServicesIntoHostJson: null / empty input still produces a clean record", () => {
  const merged = mergeServicesIntoHostJson(null, {
    Promenade: false,
    Garde: true,
    Pension: false,
  });
  assert.deepEqual(merged.services, { Promenade: false, Garde: true, Pension: false });
  assert.ok(typeof merged.updatedAt === "string");
});

test("mergeServicesIntoHostJson: corrupted JSON is treated as empty (does not throw)", () => {
  const merged = mergeServicesIntoHostJson("{ not valid json :: ", {
    Promenade: true,
    Garde: false,
    Pension: false,
  });
  assert.deepEqual(merged.services, { Promenade: true, Garde: false, Pension: false });
});
