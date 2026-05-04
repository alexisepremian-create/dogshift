#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DogShift Weekly Deep Dependency Scan
 *
 * Every Monday: fetches release notes for sensitive packages (Clerk, Stripe, Next.js)
 * since the currently installed version, asks Claude for a risk assessment,
 * sends a Telegram digest and posts a report to the admin panel.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "977094430";
const MAINTENANCE_API_KEY = process.env.MAINTENANCE_API_KEY ?? "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").replace(/\/$/, "");

const WATCH_LIST = [
  { pkg: "next", githubRepo: "vercel/next.js" },
  { pkg: "@clerk/nextjs", githubRepo: "clerk/javascript" },
  { pkg: "stripe", githubRepo: "stripe/stripe-node" },
  { pkg: "@stripe/stripe-js", githubRepo: "stripe/stripe-js" },
  { pkg: "prisma", githubRepo: "prisma/prisma" },
  { pkg: "@prisma/client", githubRepo: "prisma/prisma" },
];


async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" }),
    });
  } catch { /* fire-and-forget */ }
}

async function askClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return "ANTHROPIC_API_KEY not set";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json() as any;
  return data.content?.[0]?.text ?? "";
}

async function fetchGithubReleases(repo: string, since: string): Promise<{ tag: string; body: string }[]> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=20`, { headers });
    if (!res.ok) return [];
    const releases = await res.json() as any[];
    return releases
      .filter((r: any) => r.tag_name > `v${since}` || r.tag_name > since)
      .map((r: any) => ({ tag: r.tag_name, body: (r.body ?? "").slice(0, 3000) }));
  } catch {
    return [];
  }
}

function getInstalledVersion(pkg: string): string {
  try {
    const pkgJson = JSON.parse(
      readFileSync(join(ROOT, "node_modules", pkg, "package.json"), "utf8")
    ) as any;
    return pkgJson.version ?? "?";
  } catch {
    return "?";
  }
}

async function main() {
  const startedAt = Date.now();
  console.log("🔍 DogShift Weekly Deep Scan starting…\n");

  const reportItems: { pkg: string; version: string; releases: number; risk: string; summary: string }[] = [];

  for (const { pkg, githubRepo } of WATCH_LIST) {
    const installed = getInstalledVersion(pkg);
    console.log(`\n📦 ${pkg} (installed: ${installed})`);

    const releases = await fetchGithubReleases(githubRepo, installed);
    if (releases.length === 0) {
      console.log(`  ✓ No new releases since ${installed}`);
      reportItems.push({ pkg, version: installed, releases: 0, risk: "none", summary: "Up to date" });
      continue;
    }

    console.log(`  ${releases.length} new release(s) found`);

    const releaseNotes = releases
      .slice(0, 5)
      .map(r => `### ${r.tag}\n${r.body}`)
      .join("\n\n---\n\n");

    const assessment = await askClaude(`
You are a senior TypeScript/Next.js engineer reviewing dependency updates for a Next.js 16 app called DogShift — a Swiss dog-sitting marketplace.

Package: ${pkg} (currently installed: v${installed})
New releases since installed version:

${releaseNotes}

Relevant tech stack: Next.js 16 App Router, React 19, TypeScript, Prisma, Clerk auth, Stripe Connect, Tailwind CSS.

Respond in this EXACT format (no other text):
RISK: low|medium|high
SUMMARY: [1-2 sentence summary of what changed and what risk it poses for DogShift]
ACTION: [specific action needed, or "None — nightly agent will handle" if it's a safe bump]
`);

    const riskMatch = assessment.match(/RISK:\s*(low|medium|high)/i);
    const summaryMatch = assessment.match(/SUMMARY:\s*(.+?)(?:\n|ACTION:)/s);
    const actionMatch = assessment.match(/ACTION:\s*(.+)/s);

    const risk = riskMatch?.[1]?.toLowerCase() ?? "unknown";
    const summary = summaryMatch?.[1]?.trim() ?? assessment.slice(0, 200);
    const action = actionMatch?.[1]?.trim() ?? "";

    console.log(`  Risk: ${risk} — ${summary}`);
    reportItems.push({ pkg, version: installed, releases: releases.length, risk, summary: `${summary} | Action: ${action}` });
  }

  // Build Telegram digest
  const riskEmoji = (r: string) => r === "high" ? "🔴" : r === "medium" ? "🟡" : "🟢";
  const digestLines = [
    `📅 *DogShift — Rapport hebdomadaire des dépendances*`,
    ``,
    ...reportItems.map(item =>
      item.releases === 0
        ? `${riskEmoji("none")} \`${item.pkg}\` — à jour (v${item.version})`
        : `${riskEmoji(item.risk)} \`${item.pkg}\` — ${item.releases} release(s) | ${item.risk.toUpperCase()} | ${item.summary.split("|")[0]?.trim()}`
    ),
    ``,
    `⏱ Durée : ${Math.round((Date.now() - startedAt) / 1000)}s`,
  ];

  await sendTelegram(digestLines.join("\n"));

  // Post to admin panel
  if (MAINTENANCE_API_KEY && APP_URL) {
    await fetch(`${APP_URL}/api/admin/maintenance/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MAINTENANCE_API_KEY}`,
      },
      body: JSON.stringify({
        type: "weekly_report",
        status: reportItems.some(r => r.risk === "high") ? "warning" : "success",
        packages: reportItems,
        durationMs: Date.now() - startedAt,
        summary: `Weekly scan: ${reportItems.filter(r => r.releases > 0).length} packages have updates`,
      }),
    }).catch(() => {});
  }

  console.log("\n✅ Weekly scan complete");
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `🚨 Weekly scan error: ${(err as Error).message}` }),
  }).catch(() => {});
  process.exit(1);
});
