/**
 * Regression: token generation + hashing + expiry semantics.
 *
 * If any of these regress, password reset is either insecure (predictable tokens)
 * or broken (mismatched hashes, expired-on-create tokens).
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
  resetTokenIdentifier,
} from "../../lib/auth/passwordResetToken.ts";

test("generateResetToken: plaintext is 64-hex-char (32 random bytes)", () => {
  const { plaintext } = generateResetToken();
  assert.equal(plaintext.length, 64);
  assert.match(plaintext, /^[0-9a-f]{64}$/);
});

test("generateResetToken: hash matches hashResetToken(plaintext)", () => {
  const { plaintext, hash } = generateResetToken();
  assert.equal(hash, hashResetToken(plaintext));
});

test("hashResetToken: SHA-256 deterministic and 64 hex chars", () => {
  const a = hashResetToken("abc");
  const b = hashResetToken("abc");
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("hashResetToken: different inputs produce different hashes", () => {
  assert.notEqual(hashResetToken("abc"), hashResetToken("abd"));
});

test("resetTokenExpiry: returns a Date ~1 hour in the future", () => {
  const now = new Date("2026-05-11T20:00:00Z");
  const exp = resetTokenExpiry(now);
  assert.equal(exp.getTime() - now.getTime(), 60 * 60 * 1000);
});

test("resetTokenIdentifier: namespaces by email (lowercased + trimmed)", () => {
  assert.equal(resetTokenIdentifier("  Test@Example.CH "), "password-reset:test@example.ch");
});

test("resetTokenIdentifier: stays distinct from other identifier types", () => {
  // Other features could share VerificationToken (magic links, email verify),
  // so the prefix scoping must stay in place.
  assert.ok(resetTokenIdentifier("a@b.ch").startsWith("password-reset:"));
});
