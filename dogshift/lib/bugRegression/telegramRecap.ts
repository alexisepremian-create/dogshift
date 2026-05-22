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
  formatDateFR,
  pluralFR,
  tgFooter,
  tgHeader,
  tgMessage,
  tgSection,
} from "../telegram/format.ts";

import type { FicheResult } from "./runDetections.ts";

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

  // Tout en haut du message, une ligne unique qui te dit en clair si tu dois
  // agir ou pas. Le détail vient en dessous. Si tu vois "Action requise : NON",
  // tu peux fermer le message tranquille.
  const actionBlock = (() => {
    if (failures.length > 0) {
      return `🚨 <b>Action requise : OUI</b> — ${pluralFR(
        failures.length,
        "ancien bug est revenu",
        "anciens bugs sont revenus",
      )}. Voir le détail ci-dessous.`;
    }
    if (errors.length > 0) {
      return `⚠️ <b>À investiguer</b> — ${pluralFR(
        errors.length,
        "vérification a planté",
        "vérifications ont planté",
      )} (problème du test lui-même, pas forcément un bug). Voir détail.`;
    }
    return `✅ <b>Action requise : NON</b> — tout est OK, aucun ancien bug ne refait surface. Tu peux ignorer ce message.`;
  })();

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

  // Résumé — toujours présent. Le compte "vérifications manuelles" remplace
  // l'ancien libellé "ignorée" qui faisait croire à un problème alors que
  // c'est par design (certains bugs ne sont vérifiables qu'à la main).
  const summaryBlock = [
    tgSection("📊", "Résumé"),
    `${pluralFR(results.length, "fiche", "fiches")} checkée${results.length !== 1 ? "s" : ""}`,
    `✅ ${pluralFR(passes.length, "OK")} · 🚨 ${pluralFR(failures.length, "régression")} · ⚠️ ${pluralFR(errors.length, "erreur")} · ⏭ ${pluralFR(skipped.length, "vérification manuelle", "vérifications manuelles")}`,
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
  // see which fiches are intentionally not probed (and the reason) at a
  // glance. Reason is inlined from the JSON `reason` field (truncated to
  // 1 sentence / 140 chars) so the user doesn't have to open each fiche.
  const intentionalBlock =
    isClean && intentionallySkipped.length > 0
      ? [
          tgSection(
            "⏭",
            `${pluralFR(intentionallySkipped.length, "bug à vérifier à la main", "bugs à vérifier à la main")} (pas testable automatiquement)`,
          ),
          ...intentionallySkipped.map((r) => {
            const reason = r.detection?.type === "none" ? (r.detection.reason ?? "") : "";
            const shortReason = firstSentence(reason, 140);
            return shortReason
              ? `⚪ <code>${escapeHtml(r.slug)}</code>\n   ${escapeHtml(shortReason)}`
              : `⚪ <code>${escapeHtml(r.slug)}</code> — raison non précisée dans la fiche`;
          }),
        ]
      : null;

  return tgMessage([
    tgHeader(headerEmoji, headerTitle, runDate),
    actionBlock,
    regressionsBlock,
    errorsBlock,
    summaryBlock,
    intentionalBlock,
    hintBlock,
    tgFooter(runDate),
  ]);
}

/**
 * Trim a multi-sentence string to its first sentence, capped at `max`
 * chars (default 140). Falls back to a hard truncate with `…` if the
 * first sentence itself is too long.
 */
function firstSentence(s: string, max = 140): string {
  const trimmed = s.trim();
  if (!trimmed) return "";
  // Take everything up to the first period / question / exclamation
  // that is followed by a space or end-of-string. Avoids cutting at
  // dotted file names like `lib/foo.ts`.
  const match = trimmed.match(/^.+?[.!?](?:\s|$)/);
  const sentence = (match ? match[0] : trimmed).trim().replace(/[.!?]$/, ".");
  if (sentence.length <= max) return sentence;
  return sentence.slice(0, max - 1).trimEnd() + "…";
}

/** Exposed for callers that already have an ISO string and don't want to re-parse. */
export function todayKeyToDate(todayKey: string): Date {
  return new Date(`${todayKey}T00:00:00`);
}

/** Re-exported for backwards compat with callers passing a string. */
export { formatDateFR };
