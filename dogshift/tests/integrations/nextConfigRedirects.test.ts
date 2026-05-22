import { test } from "node:test";
import assert from "node:assert/strict";

// Regression for audit 2026-05-22 bug I3 — `/sitters` used to 404 instead of
// redirecting to `/search`. This test loads the actual next.config.ts module
// and asserts the redirect is wired in.

import nextConfig from "../../next.config.ts";

test("next.config exposes redirects() with /sitters → /search 301", async () => {
  // withSentryConfig wraps the config but preserves redirects.
  const cfg = nextConfig as unknown as {
    redirects?: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>>;
  };

  assert.equal(typeof cfg.redirects, "function", "next.config.redirects must be a function");

  const list = await cfg.redirects!();
  assert.ok(Array.isArray(list), "redirects() must return an array");

  const sitters = list.find((r) => r.source === "/sitters");
  assert.ok(sitters, "missing redirect for /sitters");
  assert.equal(sitters!.destination, "/search");
  assert.equal(sitters!.permanent, true, "/sitters must use a permanent (301) redirect");
});
