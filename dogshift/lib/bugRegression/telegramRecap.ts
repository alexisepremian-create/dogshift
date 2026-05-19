/**
 * Format the nightly bug-regression-check Telegram recap.
 *
 * Visual style is aligned with the `DogShift Maintenance` daily recap
 * (the founder-approved source of truth for all Telegram messages):
 * French abbreviated date in the header + footer, one blank line
 * between sections, bold section titles, color emoji for severity.
 * See lib/telegram/format.ts for the shared helpers.
 */

import {
  escapeHtml,
  formatDateFR,
  pluralFR,
  tgFooter,
  tgHeader,
  tgMessage,
  tgSection,
} from "@/lib/telegram/format";

import type { FicheResult } from "./runDetections";

export function formatRecap(results: FicheResult[], runDate: Date = new Date()): string {
  const failures = results.filter((r) => r.outcome.status === "fail");
  const errors = results.filter((r) => r.outcome.status === "error");
  const skipped = results.filter((r) => r.outcome.status === "skipped");
  const passes = results.filter((r) => r.outcome.status === "pass");

  const headerEmoji = failures.length === 0 && errors.length === 0 ? "🌙" : "🚨";
  const headerTitle = "Bug regression check";

  // Regressions section (only if any).
  const regressionsBlock =
    failures.length > 0
      ? [
          tgSection("🚨", pluralFR(failures.length, "régression détectée", "régressions détectées")),
          ...failures.map(
            (r) =>
              `🔴 <code>${escapeHtml(r.slug)}</code>\n   ${escapeHtml(r.outcome.detail)}`,
          ),
        ]
      : null;

  // Errors section (the check itself broke).
  const errorsBlock =
    errors.length > 0
      ? [
          tgSection("⚠️", pluralFR(errors.length, "check en erreur", "checks en erreur")),
          ...errors.map(
            (r) =>
              `⚪ <code>${escapeHtml(r.slug)}</code>\n   ${escapeHtml(r.outcome.detail)}`,
          ),
        ]
      : null;

  // Summary section — always present.
  const summaryBlock = [
    tgSection("📊", "Résumé"),
    `${pluralFR(results.length, "fiche", "fiches")} checkée${results.length !== 1 ? "s" : ""}`,
    `✅ ${passes.length} pass · 🚨 ${failures.length} fail · ⚠️ ${errors.length} error · ⏭ ${skipped.length} skipped`,
  ];

  // Hint when nothing tripped AND some fiches still have no detection.
  const hintBlock =
    failures.length === 0 && errors.length === 0 && skipped.length > 0
      ? [
          `<i>💡 ${pluralFR(skipped.length, "fiche sans", "fiches sans")} bloc <code>## 🤖 Automated detection</code> — ajoute du JSON dans la fiche pour activer le check.</i>`,
        ]
      : null;

  return tgMessage([
    tgHeader(headerEmoji, headerTitle, runDate),
    regressionsBlock,
    errorsBlock,
    summaryBlock,
    hintBlock,
    tgFooter(runDate),
  ]);
}

/** Exposed for callers that already have an ISO string and don't want to re-parse. */
export function todayKeyToDate(todayKey: string): Date {
  return new Date(`${todayKey}T00:00:00`);
}

/** Re-exported for backwards compat with callers passing a string. */
export { formatDateFR };
