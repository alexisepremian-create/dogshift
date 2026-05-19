/**
 * Format the nightly bug-regression-check Telegram recap.
 *
 * Visual style aligned with the `DogShift Maintenance` daily recap (the
 * founder-approved source of truth for all Telegram messages): French
 * abbreviated date in the header + footer, one blank line between
 * sections, bold section titles, color emoji for severity. Helpers in
 * lib/telegram/format.ts.
 *
 * Title is in French ("Audit nocturne des bugs") and so are all the
 * labels — the message goes to a French-speaking founder, no reason
 * to mix English status names like "pass / fail / error".
 */

import {
  escapeHtml,
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

  // Split skipped into "intentionally not auto-checkable" (type: none with
  // documented reason) vs "fiche has no detection block at all" — the
  // first is fine, the second is a real TODO.
  const intentionallySkipped = skipped.filter((r) => r.detection?.type === "none");
  const missingBlock = skipped.filter((r) => r.detection === null);

  const isClean = failures.length === 0 && errors.length === 0;
  const headerEmoji = isClean ? "🌙" : "🚨";
  const headerTitle = "Audit nocturne des bugs";

  // Régressions (only if any)
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

  // Checks en erreur (only if any)
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

  // Résumé — toujours présent
  const summaryBlock = [
    tgSection("📊", "Résumé"),
    `${pluralFR(results.length, "fiche", "fiches")} checkée${results.length !== 1 ? "s" : ""}`,
    `✅ ${pluralFR(passes.length, "OK")} · 🚨 ${pluralFR(failures.length, "régression")} · ⚠️ ${pluralFR(errors.length, "erreur")} · ⏭ ${pluralFR(skipped.length, "ignorée")}`,
  ];

  // Hint — only show if there's a REAL TODO (missing block). Intentional
  // type:none skips don't deserve a hint.
  const hintBlock =
    missingBlock.length > 0
      ? [
          `<i>💡 ${pluralFR(missingBlock.length, "fiche sans", "fiches sans")} bloc <code>## 🤖 Automated detection</code> — ajoute du JSON dans ces fiches pour activer le check.</i>`,
        ]
      : null;

  // Detail of intentional skips — show only on green nights so you can
  // see which fiches are intentionally not probed (and why) at a glance.
  const intentionalBlock =
    isClean && intentionallySkipped.length > 0
      ? [
          tgSection("⏭", pluralFR(intentionallySkipped.length, "fiche non auto-checkable", "fiches non auto-checkables")),
          ...intentionallySkipped.map(
            (r) => `⚪ <code>${escapeHtml(r.slug)}</code> — raison documentée dans la fiche`,
          ),
        ]
      : null;

  return tgMessage([
    tgHeader(headerEmoji, headerTitle, runDate),
    regressionsBlock,
    errorsBlock,
    summaryBlock,
    intentionalBlock,
    hintBlock,
    tgFooter(runDate),
  ]);
}

/** Exposed for callers that already have an ISO string and don't want to re-parse. */
export function todayKeyToDate(todayKey: string): Date {
  return new Date(`${todayKey}T00:00:00`);
}
