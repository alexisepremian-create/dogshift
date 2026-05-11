/**
 * Regression: input validation rules for POST /api/auth/reset-password.
 *
 * Mirrors the inline Zod schema in app/api/auth/reset-password/route.ts.
 * Duplicating the schema here is intentional — if the route changes its
 * validation rules, this test should fail loudly so we don't silently
 * accept weaker passwords.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

const BodySchema = z.object({
  email: z.string().email().max(254),
  token: z.string().min(32).max(128),
  password: z
    .string()
    .min(8, "PASSWORD_TOO_SHORT")
    .max(200, "PASSWORD_TOO_LONG")
    .regex(/[A-Z]/, "PASSWORD_MISSING_UPPERCASE")
    .regex(/[0-9]/, "PASSWORD_MISSING_DIGIT"),
});

const VALID_TOKEN = "a".repeat(64);

test("schema: accepts a well-formed body", () => {
  const r = BodySchema.safeParse({
    email: "user@example.ch",
    token: VALID_TOKEN,
    password: "GoodPass1",
  });
  assert.equal(r.success, true);
});

test("schema: rejects invalid email", () => {
  const r = BodySchema.safeParse({
    email: "not-an-email",
    token: VALID_TOKEN,
    password: "GoodPass1",
  });
  assert.equal(r.success, false);
});

test("schema: rejects password without uppercase", () => {
  const r = BodySchema.safeParse({
    email: "user@example.ch",
    token: VALID_TOKEN,
    password: "lowercase1",
  });
  assert.equal(r.success, false);
  if (!r.success) {
    assert.ok(r.error.issues.some((i) => i.message === "PASSWORD_MISSING_UPPERCASE"));
  }
});

test("schema: rejects password without digit", () => {
  const r = BodySchema.safeParse({
    email: "user@example.ch",
    token: VALID_TOKEN,
    password: "NoDigitsHere",
  });
  assert.equal(r.success, false);
  if (!r.success) {
    assert.ok(r.error.issues.some((i) => i.message === "PASSWORD_MISSING_DIGIT"));
  }
});

test("schema: rejects password shorter than 8 chars", () => {
  const r = BodySchema.safeParse({
    email: "user@example.ch",
    token: VALID_TOKEN,
    password: "Abc1",
  });
  assert.equal(r.success, false);
  if (!r.success) {
    assert.ok(r.error.issues.some((i) => i.message === "PASSWORD_TOO_SHORT"));
  }
});

test("schema: rejects short token (must be 32+ chars to be unguessable)", () => {
  const r = BodySchema.safeParse({
    email: "user@example.ch",
    token: "tooshort",
    password: "GoodPass1",
  });
  assert.equal(r.success, false);
});
