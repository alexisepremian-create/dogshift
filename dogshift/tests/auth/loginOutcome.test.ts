import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveCredentialsLoginOutcome } from "../../lib/auth/loginOutcome.ts";

// Regression: Auth.js v5 (beta) can resolve signIn() with
// { error: "CredentialsSignin" } even when the JWT cookie WAS set. The UI must
// NOT show "wrong password" in that case — the session is authoritative.
// See docs/bugs/login-false-invalid-credentials.md.

test("clean signIn success → success", () => {
  assert.equal(resolveCredentialsLoginOutcome({ ok: true, error: null }, false), "success");
  assert.equal(resolveCredentialsLoginOutcome({ ok: true }, false), "success");
});

test("THE BUG: spurious CredentialsSignin error but a real session exists → success", () => {
  assert.equal(
    resolveCredentialsLoginOutcome({ error: "CredentialsSignin", ok: false }, true),
    "success",
  );
});

test("spurious error + session → success even for unknown error codes", () => {
  assert.equal(resolveCredentialsLoginOutcome({ error: "SomethingWeird" }, true), "success");
  assert.equal(resolveCredentialsLoginOutcome(null, true), "success");
  assert.equal(resolveCredentialsLoginOutcome(undefined, true), "success");
});

test("genuine wrong credentials: CredentialsSignin + no session → wrong_credentials", () => {
  assert.equal(
    resolveCredentialsLoginOutcome({ error: "CredentialsSignin", ok: false }, false),
    "wrong_credentials",
  );
});

test("migrated account (no password) takes priority over generic wrong_credentials", () => {
  assert.equal(
    resolveCredentialsLoginOutcome({ error: "MIGRATED_NO_PASSWORD" }, false),
    "migrated_no_password",
  );
  // Realistic shape: next-auth sets a generic `error` plus the thrown `code`.
  assert.equal(
    resolveCredentialsLoginOutcome({ error: "CredentialsSignin", code: "MIGRATED_NO_PASSWORD" }, false),
    "migrated_no_password",
  );
});

test("a result with no error field means the session was set → success", () => {
  // Guards the ordering: absence of `error` is authoritative success, never a
  // false failure, regardless of other fields.
  assert.equal(resolveCredentialsLoginOutcome({ ok: true, code: "whatever" }, false), "success");
});

test("no result and no session → retry (transient/network)", () => {
  assert.equal(resolveCredentialsLoginOutcome(null, false), "retry");
  assert.equal(resolveCredentialsLoginOutcome(undefined, false), "retry");
});

test("migrated error but session somehow exists → success (session wins)", () => {
  // Defensive: if a session truly exists, we never block the user.
  assert.equal(
    resolveCredentialsLoginOutcome({ error: "MIGRATED_NO_PASSWORD" }, true),
    "success",
  );
});
