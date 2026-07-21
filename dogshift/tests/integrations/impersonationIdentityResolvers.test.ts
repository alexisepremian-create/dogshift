import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression for "Voir comme (impersonation) ne fonctionne pas" (2026-07-21).
//
// The impersonation cookie was only honored by getAuthedDbUser(). But the
// generic identity resolvers that most of /account + /host go through —
// getUserContexts(), resolveDbUserId(), ensureDbUserFromClerkAuth(),
// requireSitterOwner() — all resolved the user straight from `auth()` (the
// REAL admin session), so an admin who started impersonation still saw THEIR
// OWN data. The feature looked completely broken.
//
// Fix: a shared resolveEffectiveUserId() (impersonation-aware, with a
// zero-extra-query fast path) that every generic resolver funnels through.
// These file-level asserts lock that wiring so a future refactor can't
// silently revert a resolver to a bare `auth()` identity read.

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("getAuthedDbUser exports an impersonation-aware resolveEffectiveUserId", () => {
  const src = read("../../lib/auth/getAuthedDbUser.ts");
  assert.match(
    src,
    /export async function resolveEffectiveUserId\(\)/,
    "resolveEffectiveUserId must be exported so every resolver can share it.",
  );
  assert.match(
    src,
    /IMPERSONATION_COOKIE/,
    "resolveEffectiveUserId must consult the impersonation cookie.",
  );
});

test("resolveDbUserId routes through resolveEffectiveUserId (not bare auth id)", () => {
  const src = read("../../lib/auth/resolveDbUserId.ts");
  assert.match(src, /resolveEffectiveUserId/, "resolveDbUserId must use resolveEffectiveUserId.");
  // The function body must not return the raw session id anymore.
  assert.doesNotMatch(
    src,
    /return\s+session\?\.user\?\.id\s*\?\?\s*null;/,
    "resolveDbUserId must not resolve identity from the raw session (ignores impersonation).",
  );
});

test("requireSitterOwner routes through resolveEffectiveUserId", () => {
  const src = read("../../lib/auth/requireSitterOwner.ts");
  assert.match(src, /resolveEffectiveUserId/, "requireSitterOwner must use resolveEffectiveUserId.");
  assert.doesNotMatch(
    src,
    /const\s+session\s*=\s*await\s+auth\(\)/,
    "requireSitterOwner must not read the raw session for identity (ignores impersonation).",
  );
});

test("getUserContexts routes through resolveEffectiveUserId", () => {
  const src = read("../../lib/userContexts.ts");
  assert.match(src, /resolveEffectiveUserId/, "getUserContexts must use resolveEffectiveUserId.");
  assert.doesNotMatch(
    src,
    /const\s+session\s*=\s*await\s+auth\(\)/,
    "getUserContexts must not read the raw session for identity (ignores impersonation).",
  );
});

test("ensureDbUserFromClerkAuth routes through resolveEffectiveUserId", () => {
  const src = read("../../lib/auth/resolveDbUserId.ts");
  assert.match(
    src,
    /ensureDbUserFromClerkAuth[\s\S]*?resolveEffectiveUserId/,
    "ensureDbUserFromClerkAuth must resolve the effective (possibly impersonated) user id.",
  );
});
