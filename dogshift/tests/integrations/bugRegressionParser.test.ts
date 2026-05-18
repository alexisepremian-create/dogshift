/**
 * Unit test for lib/bugRegression/parseBugFiches.
 *
 * We don't mock the filesystem — we write a few real fixture files to a temp
 * dir and parse them. Keeps the parser honest about what real bug fiches
 * look like.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseBugFiches } from "../../lib/bugRegression/parseBugFiches.ts";

function setupRepo(fiches: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "bug-regression-test-"));
  mkdirSync(join(root, "docs", "bugs"), { recursive: true });
  for (const [name, content] of Object.entries(fiches)) {
    writeFileSync(join(root, "docs", "bugs", name), content, "utf8");
  }
  return root;
}

test("parser ignores README.md", () => {
  const root = setupRepo({
    "README.md": "# Index",
    "alpha.md": "# Alpha\n\nNo detection block.",
  });
  const result = parseBugFiches(root);
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "alpha");
});

test("fiche without detection block parses to null detection", () => {
  const root = setupRepo({
    "no-block.md": "# Bug\n\nSome content without the heading.",
  });
  const [r] = parseBugFiches(root);
  assert.equal(r.detection, null);
  assert.equal(r.parseError, null);
});

test("fiche with valid HTTP detection block parses correctly", () => {
  const root = setupRepo({
    "http-bug.md": [
      "# Bug",
      "",
      "## 🤖 Automated detection",
      "",
      "```json",
      JSON.stringify({
        type: "http",
        url: "https://example.com/health",
        expect_status: 200,
        expect_contains: "ok",
        auto_fix: { complexity: "simple" },
      }),
      "```",
    ].join("\n"),
  });
  const [r] = parseBugFiches(root);
  assert.equal(r.parseError, null);
  assert.ok(r.detection);
  assert.equal(r.detection!.type, "http");
  if (r.detection!.type === "http") {
    assert.equal(r.detection.url, "https://example.com/health");
    assert.equal(r.detection.expect_status, 200);
    assert.equal(r.detection.expect_contains, "ok");
  }
  assert.equal(r.detection!.auto_fix?.complexity, "simple");
});

test("fiche with SQL detection parses correctly", () => {
  const root = setupRepo({
    "sql-bug.md": [
      "# Bug",
      "",
      "## 🤖 Automated detection",
      "",
      "```json",
      '{"type":"sql","query":"SELECT 1 AS value","expect_max":0}',
      "```",
    ].join("\n"),
  });
  const [r] = parseBugFiches(root);
  assert.equal(r.parseError, null);
  assert.equal(r.detection?.type, "sql");
});

test("fiche with `type: none` parses as a skip directive", () => {
  const root = setupRepo({
    "none-bug.md": [
      "# Bug",
      "",
      "## 🤖 Automated detection",
      "",
      "```json",
      '{"type":"none","reason":"only reproducible on mobile"}',
      "```",
    ].join("\n"),
  });
  const [r] = parseBugFiches(root);
  assert.equal(r.parseError, null);
  assert.equal(r.detection?.type, "none");
});

test("malformed JSON inside the block surfaces parseError", () => {
  const root = setupRepo({
    "bad-bug.md": [
      "# Bug",
      "",
      "## 🤖 Automated detection",
      "",
      "```json",
      "{type: http, url: not-quoted}",
      "```",
    ].join("\n"),
  });
  const [r] = parseBugFiches(root);
  assert.equal(r.detection, null);
  assert.match(r.parseError ?? "", /JSON\.parse/);
});

test("heading found but no code block surfaces parseError", () => {
  const root = setupRepo({
    "no-fence.md": [
      "# Bug",
      "",
      "## 🤖 Automated detection",
      "",
      "Some prose but no fenced code block.",
    ].join("\n"),
  });
  const [r] = parseBugFiches(root);
  assert.equal(r.detection, null);
  assert.match(r.parseError ?? "", /no .*code block/);
});

test("ASCII fallback heading (no emoji) still matches", () => {
  const root = setupRepo({
    "ascii.md": [
      "# Bug",
      "",
      "## Automated detection",
      "",
      "```json",
      '{"type":"none","reason":"x"}',
      "```",
    ].join("\n"),
  });
  const [r] = parseBugFiches(root);
  assert.equal(r.detection?.type, "none");
});
