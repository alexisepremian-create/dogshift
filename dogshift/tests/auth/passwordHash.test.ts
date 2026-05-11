/**
 * Regression: bcrypt round-trip for the reset-password flow.
 *
 * We must always hash with cost ≥ 12 (matches /api/auth/reset-password) and
 * the compare must succeed for the right password and fail otherwise. If this
 * ever breaks (e.g. someone swaps bcryptjs for bcrypt-native which behaves
 * differently on Vercel serverless), reset-password silently locks every user
 * out of their account.
 */
import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

test("bcrypt: hash with cost 12 round-trips for the right password", async () => {
  const pw = "Sup3rSecret!";
  const hash = await bcrypt.hash(pw, 12);
  assert.ok(hash.startsWith("$2"), "expected a bcrypt-format hash");
  assert.equal(await bcrypt.compare(pw, hash), true);
});

test("bcrypt: compare rejects wrong password", async () => {
  const hash = await bcrypt.hash("Sup3rSecret!", 12);
  assert.equal(await bcrypt.compare("WrongPass1!", hash), false);
});

test("bcrypt: same plaintext produces different hashes (salt is random)", async () => {
  const pw = "Sup3rSecret!";
  const a = await bcrypt.hash(pw, 12);
  const b = await bcrypt.hash(pw, 12);
  assert.notEqual(a, b);
  assert.equal(await bcrypt.compare(pw, a), true);
  assert.equal(await bcrypt.compare(pw, b), true);
});
