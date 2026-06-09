/**
 * Regression: the email-first auth flow routing decision.
 *
 * `decideAuthStep` (lib/auth/decideAuthStep.ts) maps the /api/auth/check-email
 * response to the next UI step. The three branches must stay stable:
 *   - new email                       → signup
 *   - existing account (has password) → login
 *   - existing account (no password)  → login (UI then shows the Google/reset hint)
 */
import test from "node:test";
import assert from "node:assert/strict";

import { decideAuthStep } from "../../lib/auth/decideAuthStep.ts";

test("new email → signup step", () => {
  assert.equal(decideAuthStep({ exists: false, hasPassword: false }), "signup");
});

test("existing account with password → login step", () => {
  assert.equal(decideAuthStep({ exists: true, hasPassword: true }), "login");
});

test("existing account without password (Google-only) → login step", () => {
  assert.equal(decideAuthStep({ exists: true, hasPassword: false }), "login");
});
