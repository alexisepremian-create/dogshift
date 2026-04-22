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
// isSitterRecord
// ---------------------------------------------------------------------------

test("isSitterRecord: a user with a sitterProfile is a sitter (any role)", () => {
  assert.equal(
    isSitterRecord({ role: "OWNER", sitterProfile: { id: "p1" } }),
    true,
  );
  assert.equal(
    isSitterRecord({ role: "SITTER", sitterProfile: { id: "p1" } }),
    true,
  );
});

test("isSitterRecord: a user without sitterProfile but role=SITTER is still a sitter (legacy path)", () => {
  assert.equal(isSitterRecord({ role: "SITTER", sitterProfile: null }), true);
});

test("isSitterRecord: OWNER with no sitter profile is not a sitter", () => {
  assert.equal(isSitterRecord({ role: "OWNER", sitterProfile: null }), false);
});

test("isSitterRecord: null / undefined user yields false", () => {
  assert.equal(isSitterRecord(null), false);
  assert.equal(isSitterRecord(undefined), false);
});
