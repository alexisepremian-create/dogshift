/**
 * Execute a parsed detection config and return whether the bug appears to
 * have regressed. The runner is intentionally narrow: HTTP probes and
 * single-scalar SQL queries. Anything else is `type: "none"` and the cron
 * just notes that no auto-check is defined.
 */

import { prisma } from "@/lib/prisma";

import type { BugFiche, DetectionConfig } from "./parseBugFiches";

export type CheckOutcome =
  | { status: "pass"; detail: string }
  | { status: "fail"; detail: string }
  | { status: "skipped"; detail: string }
  | { status: "error"; detail: string };

export type FicheResult = {
  slug: string;
  filePath: string;
  outcome: CheckOutcome;
  detection: DetectionConfig | null;
};

const DEFAULT_TIMEOUT_MS = 15_000;

async function runHttp(d: Extract<DetectionConfig, { type: "http" }>): Promise<CheckOutcome> {
  const expectStatus = d.expect_status ?? 200;
  const timeoutMs = d.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const headers: Record<string, string> = { "user-agent": "dogshift-bug-regression-check/1.0" };
  if (d.bearer_env) {
    const tok = (process.env[d.bearer_env] ?? "").trim();
    if (!tok) {
      return { status: "error", detail: `env var ${d.bearer_env} is empty — cannot send Bearer` };
    }
    headers.authorization = `Bearer ${tok}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(d.url, { method: "GET", headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "fail", detail: `fetch threw: ${msg}` };
  }
  clearTimeout(timer);

  if (res.status !== expectStatus) {
    return {
      status: "fail",
      detail: `expected status ${expectStatus}, got ${res.status} (${d.url})`,
    };
  }

  if (d.expect_contains || d.expect_not_contains) {
    const body = await res.text().catch(() => "");
    if (d.expect_contains && !body.includes(d.expect_contains)) {
      return {
        status: "fail",
        detail: `response body missing "${d.expect_contains}"`,
      };
    }
    if (d.expect_not_contains && body.includes(d.expect_not_contains)) {
      return {
        status: "fail",
        detail: `response body should NOT contain "${d.expect_not_contains}" but does`,
      };
    }
  }

  return { status: "pass", detail: `HTTP ${res.status} as expected` };
}

async function runSql(d: Extract<DetectionConfig, { type: "sql" }>): Promise<CheckOutcome> {
  try {
    // Trust the query is hand-written by the fiche author — bug fiches are
    // versioned in docs/ and reviewed via PR, so this is not user-input.
    // The convention is that the query returns rows with a `value` column.
    const rows = (await prisma.$queryRawUnsafe(d.query)) as Array<{ value: number | bigint }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      return { status: "error", detail: "SQL returned no rows" };
    }
    const raw = rows[0].value;
    const value = typeof raw === "bigint" ? Number(raw) : raw;
    const max = d.expect_max ?? 0;
    if (typeof value !== "number" || Number.isNaN(value)) {
      return { status: "error", detail: `SQL returned non-numeric value: ${String(raw)}` };
    }
    if (value > max) {
      return { status: "fail", detail: `SQL returned ${value}, expected ≤ ${max}` };
    }
    return { status: "pass", detail: `SQL returned ${value} (≤ ${max})` };
  } catch (err) {
    return { status: "error", detail: `SQL threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function runFiche(fiche: BugFiche): Promise<FicheResult> {
  if (fiche.parseError) {
    return {
      slug: fiche.slug,
      filePath: fiche.filePath,
      detection: null,
      outcome: { status: "error", detail: `fiche parse error: ${fiche.parseError}` },
    };
  }
  if (!fiche.detection) {
    return {
      slug: fiche.slug,
      filePath: fiche.filePath,
      detection: null,
      outcome: {
        status: "skipped",
        detail: "no `## 🤖 Automated detection` block in this fiche — add one to enable nightly checks",
      },
    };
  }
  const d = fiche.detection;
  let outcome: CheckOutcome;
  if (d.type === "http") {
    outcome = await runHttp(d);
  } else if (d.type === "sql") {
    outcome = await runSql(d);
  } else if (d.type === "none") {
    outcome = { status: "skipped", detail: d.reason ?? "intentionally not auto-checked" };
  } else {
    outcome = {
      status: "error",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detail: `unknown detection type: ${(d as any).type}`,
    };
  }
  return { slug: fiche.slug, filePath: fiche.filePath, detection: d, outcome };
}

export async function runAll(fiches: BugFiche[]): Promise<FicheResult[]> {
  // Sequential to avoid burst-hitting prod with parallel probes.
  const results: FicheResult[] = [];
  for (const f of fiches) {
    results.push(await runFiche(f));
  }
  return results;
}
