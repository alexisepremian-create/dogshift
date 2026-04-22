import test from "node:test";
import assert from "node:assert/strict";

import {
  isSitterRecord,
  normalizeApplicationEmail,
} from "../../lib/sitterApplication/existingSitter.ts";

// ---------------------------------------------------------------------------
// normalizeApplicationEmail
// ---------------------------------------------------------------------------

test("normalizeApplicationEmail: trims, lowercases and keeps the rest untouched", () => {
  assert.equal(
    normalizeApplicationEmail("  Alex@Example.COM  "),
    "alex@example.com",
  );
});

test("normalizeApplicationEmail: empty string stays empty (safe for caller)", () => {
  assert.equal(normalizeApplicationEmail(""), "");
  assert.equal(normalizeApplicationEmail("   "), "");
});

// ---------------------------------------------------------------------------
// isSitterRecord — only ACTIVE dog-sitter profiles should block re-application
// ---------------------------------------------------------------------------

test("isSitterRecord: published SitterProfile → sitter", () => {
  assert.equal(
    isSitterRecord({
      role: "OWNER",
      sitterProfile: {
        id: "p1",
        published: true,
        activatedAt: null,
        lifecycleStatus: "contract_signed",
      },
    }),
    true,
  );
});

test("isSitterRecord: SitterProfile with activatedAt → sitter", () => {
  assert.equal(
    isSitterRecord({
      role: "OWNER",
      sitterProfile: {
        id: "p1",
        published: false,
        activatedAt: new Date("2026-01-01T00:00:00Z"),
        lifecycleStatus: "activated",
      },
    }),
    true,
  );
});

test("isSitterRecord: SitterProfile with lifecycleStatus=activated → sitter", () => {
  assert.equal(
    isSitterRecord({
      role: "SITTER",
      sitterProfile: {
        id: "p1",
        published: false,
        activatedAt: null,
        lifecycleStatus: "activated",
      },
    }),
    true,
  );
});

test("isSitterRecord: dangling SitterProfile (application_received, not published, not activated) → NOT sitter", () => {
  // Represents Luigi-style case: user once started the sitter onboarding but
  // never made it live; they still use the platform as an owner and must be
  // allowed to re-apply if they want to.
  assert.equal(
    isSitterRecord({
      role: "OWNER",
      sitterProfile: {
        id: "p1",
        published: false,
        activatedAt: null,
        lifecycleStatus: "application_received",
      },
    }),
    false,
  );
});

test("isSitterRecord: role=SITTER alone (no SitterProfile at all) → NOT sitter", () => {
  // Legacy role flag without a matching active profile is not enough — we
  // rely on the authoritative SitterProfile signals.
  assert.equal(
    isSitterRecord({ role: "SITTER", sitterProfile: null }),
    false,
  );
});

test("isSitterRecord: OWNER with no sitter profile is not a sitter", () => {
  assert.equal(
    isSitterRecord({ role: "OWNER", sitterProfile: null }),
    false,
  );
});

test("isSitterRecord: null / undefined user yields false", () => {
  assert.equal(isSitterRecord(null), false);
  assert.equal(isSitterRecord(undefined), false);
});
