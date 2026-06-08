import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPublicProbes } from "../../lib/agents/profileHealthProbes.ts";

// Regression for audit 2026-06-08 : `/login` triggered a Cloudflare Managed
// Challenge that returned 403 to our server-side probe, generating a
// persistent false-positive every night. The real auth surveillance lives
// in /api/cron/auth-health-check (full sign-in cycle). We removed /login
// (and /signup, same reason) from the public probes.

test("public probes must NOT include /login (Cloudflare 403)", () => {
  const probes = buildPublicProbes("https://www.dogshift.ch");
  const urls = probes.map((p) => p.url);
  assert.ok(
    !urls.some((u) => u.endsWith("/login")),
    `public probes must not include /login. Got: ${urls.join(", ")}`,
  );
});

test("public probes must NOT include /signup (Cloudflare 403)", () => {
  const probes = buildPublicProbes("https://www.dogshift.ch");
  const urls = probes.map((p) => p.url);
  assert.ok(
    !urls.some((u) => u.endsWith("/signup")),
    `public probes must not include /signup. Got: ${urls.join(", ")}`,
  );
});

test("public probes must still cover the homepage and devenir-dogsitter", () => {
  const probes = buildPublicProbes("https://www.dogshift.ch");
  const names = probes.map((p) => p.name);
  assert.ok(names.includes("homepage"), `expected 'homepage' probe. Got: ${names.join(", ")}`);
  assert.ok(
    names.includes("become-sitter"),
    `expected 'become-sitter' probe. Got: ${names.join(", ")}`,
  );
});

test("public probes baseUrl is concatenated correctly", () => {
  const probes = buildPublicProbes("https://www.dogshift.ch");
  for (const p of probes) {
    assert.ok(
      p.url.startsWith("https://www.dogshift.ch/"),
      `probe URL ${p.url} must start with the base URL`,
    );
  }
});
