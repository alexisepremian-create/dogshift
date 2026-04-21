import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import { buildValidationErrorBody } from "../../lib/validators/zodErrorFormat.ts";

// Locks in that validation error bodies expose a human-readable `details` string
// alongside the structured `issues` array. Client code at
// app/(protected)/host/profile/edit/page.tsx prefers `details` when present,
// so if this regresses users see the bare "VALIDATION_ERROR" again.

test("buildValidationErrorBody: summarises field + message into `details`", () => {
  const schema = z.object({ email: z.string().email(), age: z.number().int() });
  const parsed = schema.safeParse({ email: "not-an-email", age: 3.5 });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const body = buildValidationErrorBody(parsed.error);

  assert.equal(body.ok, false);
  assert.equal(body.error, "VALIDATION_ERROR");
  assert.ok(body.issues.length >= 1, "expected at least one issue");
  assert.equal(typeof body.details, "string");
  assert.ok((body.details ?? "").includes("email"), "details should mention the offending field name");
});

test("buildValidationErrorBody: includes every field's message separated by `; `", () => {
  const schema = z.object({ a: z.string(), b: z.number() });
  const parsed = schema.safeParse({ a: 42, b: "nope" });
  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const body = buildValidationErrorBody(parsed.error);
  const details = body.details ?? "";
  assert.ok(details.includes("a:"), "expected field `a` in details");
  assert.ok(details.includes("b:"), "expected field `b` in details");
  assert.ok(details.includes(";"), "expected multiple issues joined with `;`");
});
