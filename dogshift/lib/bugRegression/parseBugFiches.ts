/**
 * Parse every bug fiche under docs/bugs/*.md and extract its optional
 * "Automated detection" JSON block.
 *
 * Convention enforced by docs/bugs/README.md: each fiche may include
 *
 *   ## 🤖 Automated detection
 *
 *   ```json
 *   { "type": "http", "url": "...", "expect_status": 200, ... }
 *   ```
 *
 * Fiches without a detection block are reported as `skipped` by the nightly
 * cron — that's a signal to add one. The cron itself never fails because of
 * a missing block; it just shows up in the recap.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type HttpDetection = {
  type: "http";
  /** Absolute URL to GET. */
  url: string;
  /** Expected HTTP status code. Defaults to 200. */
  expect_status?: number;
  /** Substring that MUST appear in the response body. */
  expect_contains?: string;
  /** Substring that MUST NOT appear in the response body. */
  expect_not_contains?: string;
  /** Bearer token env var name (e.g. "CRON_SECRET"). Sent as Authorization. */
  bearer_env?: string;
  /** Max round-trip ms before the check is marked timed out. Defaults to 15000. */
  timeout_ms?: number;
};

export type SqlDetection = {
  type: "sql";
  /** Prisma raw SQL — must be SELECT-only and return a single scalar `value` column. */
  query: string;
  /** Maximum acceptable value (e.g. 0 means "must be zero"). */
  expect_max?: number;
};

export type NoDetection = { type: "none"; reason?: string };

export type Detection = HttpDetection | SqlDetection | NoDetection;

export type AutoFix = {
  complexity: "simple" | "complex";
  /** Path to a patch script that applies the fix (relative to repo root). */
  patch_script?: string;
};

export type DetectionConfig = Detection & { auto_fix?: AutoFix };

export type BugFiche = {
  /** kebab-case slug, matches filename without .md */
  slug: string;
  /** Full path on disk (so the cron can link to the fiche). */
  filePath: string;
  /** Detection config or null if the fiche has no block. */
  detection: DetectionConfig | null;
  /** Parsing error if the block existed but was malformed. */
  parseError: string | null;
};

/**
 * Extract the JSON block under "## 🤖 Automated detection" (or the ASCII
 * fallback "## Automated detection" if someone removed the emoji). Returns
 * the parsed object, or null + an error message.
 */
function extractDetectionBlock(markdown: string): { json: DetectionConfig | null; error: string | null } {
  // Match the heading + a fenced code block (```json ... ```) that follows.
  const headingMatch = markdown.match(
    /^##\s+(?:🤖\s+)?Automated detection\s*$/m,
  );
  if (!headingMatch) return { json: null, error: null };

  const startIndex = (headingMatch.index ?? 0) + headingMatch[0].length;
  const tail = markdown.slice(startIndex);
  const fenceMatch = tail.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (!fenceMatch) {
    return { json: null, error: "heading found but no ```json``` code block underneath" };
  }
  const raw = fenceMatch[1].trim();
  try {
    const parsed = JSON.parse(raw) as DetectionConfig;
    return { json: parsed, error: null };
  } catch (err) {
    return { json: null, error: `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function parseBugFiches(repoRoot: string): BugFiche[] {
  const dir = join(repoRoot, "docs", "bugs");
  const filenames = readdirSync(dir).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  );
  const out: BugFiche[] = [];
  for (const filename of filenames) {
    const filePath = join(dir, filename);
    const markdown = readFileSync(filePath, "utf8");
    const slug = filename.replace(/\.md$/, "");
    const { json, error } = extractDetectionBlock(markdown);
    out.push({ slug, filePath, detection: json, parseError: error });
  }
  return out;
}
