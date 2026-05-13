#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DogShift Autonomous Dependency Agent
 *
 * Runs npm outdated, for each outdated package:
 *   1. Creates a dedicated branch
 *   2. Installs the new version
 *   3. Checks for TypeScript errors → asks Claude to fix them (up to 3 rounds)
 *   4. Commits + opens a PR with auto-merge
 *   5. Notifies Telegram
 *
 * Called by GitHub Actions (.github/workflows/deps-nightly.yml).
 * Set env: ANTHROPIC_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
 *           MAINTENANCE_API_KEY, NEXT_PUBLIC_APP_URL, GITHUB_TOKEN
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ─── Config ───────────────────────────────────────────────────────────────────

const ROOT = join(import.meta.dirname, "..");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_MAINTENANCE ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID_MAINTENANCE ?? process.env.TELEGRAM_CHAT_ID ?? "977094430";
const MAINTENANCE_API_KEY = process.env.MAINTENANCE_API_KEY ?? "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");

// Packages that require extra care (no special treatment — CI is the safety net — but we flag them in Telegram)
const SENSITIVE_PACKAGES = new Set(["next-auth", "next", "prisma", "@prisma/client", "stripe"]);

// Max Claude fix iterations per package
const MAX_FIX_ROUNDS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(cmd: string, opts: { cwd?: string; silent?: boolean } = {}): string {
  try {
    return execSync(cmd, {
      cwd: opts.cwd ?? ROOT,
      encoding: "utf8",
      stdio: opts.silent ? "pipe" : ["inherit", "pipe", "pipe"],
    }).toString().trim();
  } catch (e: any) {
    return e.stdout?.toString().trim() ?? "";
  }
}

function runOrThrow(cmd: string, cwd = ROOT): string {
  return execSync(cmd, { cwd, encoding: "utf8" }).toString().trim();
}

async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch {
    // fire-and-forget
  }
}

async function askClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json() as any;
  return data.content?.[0]?.text ?? "";
}

async function postMaintenanceReport(report: object): Promise<void> {
  if (!MAINTENANCE_API_KEY || !APP_URL) return;
  try {
    await fetch(`${APP_URL}/api/admin/maintenance/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MAINTENANCE_API_KEY}`,
      },
      body: JSON.stringify(report),
    });
  } catch {
    // non-blocking
  }
}

function prExists(branchName: string): boolean {
  const out = run(`gh pr list --head "${branchName}" --state open --json number`, { silent: true });
  try {
    const parsed = JSON.parse(out || "[]");
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function parseTsErrors(output: string): { file: string; line: number; message: string }[] {
  const errors: { file: string; line: number; message: string }[] = [];
  const regex = /^(.+?)\((\d+),\d+\):\s+error\s+TS\d+:\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    errors.push({ file: match[1], line: parseInt(match[2], 10), message: match[3] });
  }
  return errors;
}

function readFileSafe(path: string): string {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

// ─── Fix TypeScript errors with Claude ────────────────────────────────────────

async function fixTsErrors(pkgName: string, pkgVersion: string, tsOutput: string): Promise<boolean> {
  const errors = parseTsErrors(tsOutput);
  if (errors.length === 0) return true;

  // Deduplicate affected files
  const affectedFiles = [...new Set(errors.map(e => e.file))].slice(0, 8);

  const filesContent = affectedFiles
    .map(f => {
      const content = readFileSafe(join(ROOT, f));
      return content ? `\n\n### File: ${f}\n\`\`\`typescript\n${content}\n\`\`\`` : "";
    })
    .filter(Boolean)
    .join("");

  const errorSummary = errors
    .slice(0, 20)
    .map(e => `${e.file}:${e.line} — ${e.message}`)
    .join("\n");

  const prompt = `You are an expert TypeScript developer maintaining a Next.js app called DogShift.

The package \`${pkgName}\` was just upgraded to version \`${pkgVersion}\` and it introduced TypeScript errors.

## TypeScript errors (${errors.length} total, showing first 20):
${errorSummary}

## Affected source files:${filesContent}

## Your task:
Fix ALL the TypeScript errors by modifying the affected files. For each file that needs changes, output EXACTLY this format (no other text):

<<<FILE: relative/path/to/file.ts>>>
[COMPLETE new file content here, not a diff]
<<<END>>>

Rules:
- Output only the changed files in this format
- Write the complete file content, not a diff
- Do not add explanatory text outside the file blocks
- Keep all existing functionality intact
- Use the minimum change necessary to fix the errors`;

  const response = await askClaude(prompt);

  // Parse Claude's response and apply file changes
  const fileBlockRegex = /<<<FILE:\s*(.+?)>>>\n([\s\S]*?)<<<END>>>/g;
  let applied = 0;
  let blockMatch;

  while ((blockMatch = fileBlockRegex.exec(response)) !== null) {
    const relPath = blockMatch[1].trim();
    const newContent = blockMatch[2];
    const absPath = join(ROOT, relPath);
    try {
      writeFileSync(absPath, newContent, "utf8");
      applied++;
      console.log(`  ✓ Applied fix to ${relPath}`);
    } catch (e) {
      console.error(`  ✗ Could not write ${relPath}:`, e);
    }
  }

  return applied > 0;
}

// ─── Process one package ───────────────────────────────────────────────────────

interface UpdateResult {
  pkg: string;
  current: string;
  latest: string;
  status: "up_to_date" | "updated" | "pr_exists" | "ts_fix_failed" | "failed";
  prUrl?: string;
  isSensitive: boolean;
}

async function processPackage(
  pkg: string,
  current: string,
  wanted: string,
  latest: string,
): Promise<UpdateResult> {
  const isSensitive = SENSITIVE_PACKAGES.has(pkg) || [...SENSITIVE_PACKAGES].some(s => pkg.includes(s));
  const safePkg = pkg.replace(/[@/]/g, "-").replace(/^-/, "");
  const safeBranch = `auto-update/${safePkg}-${latest}`;

  console.log(`\n📦 ${pkg}: ${current} → ${latest}${isSensitive ? " ⚠️  sensitive" : ""}`);

  if (prExists(safeBranch)) {
    console.log(`  ↩ PR already exists for ${safeBranch}`);
    return { pkg, current, latest, status: "pr_exists", isSensitive };
  }

  try {
    // Create branch from main
    run(`git checkout main`);
    run(`git pull origin main --ff-only`, { silent: true });
    run(`git checkout -b ${safeBranch}`);

    // Install new version
    console.log(`  ⬇ Installing ${pkg}@${latest}…`);
    runOrThrow(`npm install ${pkg}@${latest} --save-exact=false`, ROOT);

    // TypeScript check loop
    let tsOutput = run(`npx tsc --noEmit --skipLibCheck 2>&1 || true`, { silent: true });
    let tsOk = parseTsErrors(tsOutput).length === 0;

    if (!tsOk) {
      console.log(`  🔧 TypeScript errors detected, asking Claude to fix…`);
      for (let round = 1; round <= MAX_FIX_ROUNDS && !tsOk; round++) {
        console.log(`  Round ${round}/${MAX_FIX_ROUNDS}…`);
        const fixed = await fixTsErrors(pkg, latest, tsOutput);
        if (!fixed) break;
        tsOutput = run(`npx tsc --noEmit --skipLibCheck 2>&1 || true`, { silent: true });
        tsOk = parseTsErrors(tsOutput).length === 0;
      }
    }

    if (!tsOk) {
      console.log(`  ✗ TypeScript errors remain after ${MAX_FIX_ROUNDS} rounds — aborting`);
      run(`git checkout main`);
      run(`git branch -D ${safeBranch}`, { silent: true });
      return { pkg, current, latest, status: "ts_fix_failed", isSensitive };
    }

    // Lint fix (best-effort)
    run(`npm run lint -- --fix 2>/dev/null || true`, { silent: true });

    // Commit
    run(`git add -A`);
    const hasChanges = run(`git diff --cached --name-only`, { silent: true }).length > 0;
    if (!hasChanges) {
      run(`git checkout main`);
      return { pkg, current, latest, status: "up_to_date", isSensitive };
    }

    const commitMsg = `build(deps): bump ${pkg} from ${current} to ${latest}${isSensitive ? "\n\nSensitive package — CI + Playwright tests gate this merge." : ""}`;
    run(`git commit -m "${commitMsg.replace(/\n/g, "\\n").replace(/"/g, '\\"')}"`);
    run(`git push -u origin ${safeBranch}`);

    // Create PR
    const prBody = [
      `Automated dependency update for \`${pkg}\` ${current} → ${latest}.`,
      "",
      isSensitive ? `> ⚠️ **Sensitive package** — Playwright E2E tests run against the Vercel preview before auto-merge.` : "",
      "",
      "CI (lint + typecheck + unit tests + Next.js build + Playwright) gates this merge.",
    ].filter(s => s !== undefined).join("\n");

    const prUrl = run(
      `gh pr create --base main --title "build(deps): bump ${pkg} to ${latest}" --body "${prBody.replace(/"/g, '\\"')}"`,
      { silent: true },
    ).trim();

    run(`gh pr merge --auto --squash --delete-branch`, { silent: true });

    console.log(`  ✅ PR created: ${prUrl}`);
    run(`git checkout main`);
    return { pkg, current, latest, status: "updated", prUrl, isSensitive };
  } catch (err) {
    console.error(`  ✗ Failed to process ${pkg}:`, err);
    run(`git checkout main`, { silent: true });
    run(`git branch -D ${safeBranch}`, { silent: true });
    return { pkg, current, latest, status: "failed", isSensitive };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = Date.now();
  console.log("🤖 DogShift Deps Agent starting…\n");

  await sendTelegram("🤖 DogShift Deps Agent démarré — analyse des dépendances en cours…");

  // Configure git
  run(`git config user.name "DogShift Deps Bot"`);
  run(`git config user.email "deps-bot@dogshift.ch"`);
  run(`git checkout main`);
  run(`git pull origin main --ff-only`);

  // Get outdated packages
  const outdatedRaw = run(`npm outdated --json 2>/dev/null || echo "{}"`, { silent: true });
  let outdated: Record<string, { current: string; wanted: string; latest: string }> = {};
  try {
    outdated = JSON.parse(outdatedRaw || "{}");
  } catch {
    outdated = {};
  }

  const packages = Object.entries(outdated);
  console.log(`Found ${packages.length} outdated package(s)\n`);

  if (packages.length === 0) {
    await sendTelegram("✅ DogShift — toutes les dépendances sont à jour.");
    await postMaintenanceReport({ status: "success", packages: [], durationMs: Date.now() - startedAt, summary: "All packages up to date" });
    return;
  }

  // Process packages sequentially to avoid git conflicts
  const results: UpdateResult[] = [];
  for (const [pkg, info] of packages) {
    const result = await processPackage(pkg, info.current, info.wanted, info.latest);
    results.push(result);
  }

  // Summary
  const updated = results.filter(r => r.status === "updated");
  const failed = results.filter(r => r.status === "ts_fix_failed" || r.status === "failed");
  const upToDate = results.filter(r => r.status === "up_to_date");
  const prExists = results.filter(r => r.status === "pr_exists");

  // Telegram notifications for each PR
  for (const r of updated) {
    const emoji = r.isSensitive ? "⚠️" : "🔧";
    const sensitiveNote = r.isSensitive ? " (paquet sensible — tests E2E obligatoires)" : "";
    await sendTelegram(
      `${emoji} [Auto-update] \`${r.pkg}\` ${r.current} → ${r.latest}${sensitiveNote}\n🔗 ${r.prUrl ?? "PR créée"}`,
    );
  }

  for (const r of failed) {
    await sendTelegram(
      `❌ [Auto-update] Échec sur \`${r.pkg}\` ${r.current} → ${r.latest} — erreurs TypeScript non résolues après ${MAX_FIX_ROUNDS} tentatives.`,
    );
  }

  const summaryLines = [
    `📊 DogShift Deps Agent — résumé`,
    `✅ Mis à jour : ${updated.length} (${updated.map(r => r.pkg).join(", ") || "—"})`,
    updated.filter(r => r.isSensitive).length > 0
      ? `⚠️  Sensibles : ${updated.filter(r => r.isSensitive).map(r => r.pkg).join(", ")}`
      : null,
    failed.length > 0 ? `❌ Échecs : ${failed.map(r => r.pkg).join(", ")}` : null,
    upToDate.length > 0 ? `✓ Déjà à jour : ${upToDate.length}` : null,
    prExists.length > 0 ? `↩ PRs existantes : ${prExists.length}` : null,
    `⏱ Durée : ${Math.round((Date.now() - startedAt) / 1000)}s`,
  ].filter(Boolean).join("\n");

  await sendTelegram(summaryLines);

  await postMaintenanceReport({
    status: failed.length > 0 ? "partial" : "success",
    packages: results,
    durationMs: Date.now() - startedAt,
    summary: `${updated.length} updated, ${failed.length} failed, ${upToDate.length} up to date`,
  });

  console.log("\n" + summaryLines);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await sendTelegram(`🚨 DogShift Deps Agent — erreur fatale : ${(err as Error).message}`);
  process.exit(1);
});
