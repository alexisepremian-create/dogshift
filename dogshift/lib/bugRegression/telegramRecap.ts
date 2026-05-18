/**
 * Format the nightly bug-regression-check Telegram recap.
 *
 * Goal: at a glance, the founder can see what the cron did last night.
 * Sections in order of importance:
 *   1. Failures (regressions detected) — must be visible immediately.
 *   2. Errors (the check itself broke).
 *   3. Skipped fiches (no detection block, or `type: none`).
 *   4. Passing checks — last, just a count.
 *
 * Even on a green night the message is sent, because "proof of work" is
 * the whole point of the cron.
 */

import type { FicheResult } from "./runDetections";

export function formatRecap(results: FicheResult[], runDate: string): string {
  const failures = results.filter((r) => r.outcome.status === "fail");
  const errors = results.filter((r) => r.outcome.status === "error");
  const skipped = results.filter((r) => r.outcome.status === "skipped");
  const passes = results.filter((r) => r.outcome.status === "pass");

  const lines: string[] = [];

  if (failures.length > 0) {
    lines.push(`🚨 <b>${failures.length} régression(s) détectée(s)</b>`);
    for (const r of failures) {
      lines.push(`  • <code>${r.slug}</code> — ${escapeHtml(r.outcome.detail)}`);
    }
    lines.push("");
  }

  if (errors.length > 0) {
    lines.push(`⚠️ <b>${errors.length} check(s) en erreur</b> (à investiguer)`);
    for (const r of errors) {
      lines.push(`  • <code>${r.slug}</code> — ${escapeHtml(r.outcome.detail)}`);
    }
    lines.push("");
  }

  const header = failures.length > 0
    ? `🌙 <b>Bug regression check — ${runDate}</b>`
    : `🌙 <b>Bug regression check — ${runDate}</b> ✅`;
  lines.unshift("", header);

  lines.push(
    `📊 Total : ${results.length} fiches → ${passes.length} ✅ pass · ${failures.length} 🚨 fail · ${errors.length} ⚠️ error · ${skipped.length} ⏭ skipped`,
  );

  if (skipped.length > 0 && failures.length === 0 && errors.length === 0) {
    lines.push("");
    lines.push(`<i>💡 ${skipped.length} fiche(s) sans <code>## 🤖 Automated detection</code> — ajoute un bloc JSON pour activer le check.</i>`);
  }

  return lines.join("\n").trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    return c;
  });
}
