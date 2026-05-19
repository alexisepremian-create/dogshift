/**
 * Shared formatting helpers for Telegram messages.
 *
 * The DogShift Maintenance daily recap (app/api/cron/maintenance-recap)
 * is the visual source of truth. Every other Telegram message —
 * bug-regression, deps-weekly, relances, candidatures, verifications,
 * news — should follow the same visual conventions so the founder can
 * scan multiple messages without re-learning the layout.
 *
 * Conventions:
 *   - parseMode "HTML" (NOT Markdown — HTML is stricter + nestable)
 *   - Header line:  <emoji> <b>Titre — 19 mai 2026</b>
 *   - One blank line between sections
 *   - Each section: <emoji> <b>Section Title</b> on one line, body below
 *   - Footer:  <i>Généré automatiquement · 19 mai 2026</i>
 *   - French abbreviated date everywhere via `formatDateFR()`
 *   - Status indicators: 🔴 high / 🟡 medium / 🟢 low / ✅ ok / ⚠️ warning
 *     / 🚨 error / ⏭ skipped — same emoji = same meaning across all messages
 *
 * Plain-text bots (verifications, relances) should still call
 * `formatDateFR` for date strings and `escapeHtml` if any user input is
 * interpolated — defense in depth in case the bot is later switched to
 * HTML mode.
 */

const MONTHS_FR = [
  "jan", "fév", "mar", "avr", "mai", "jun",
  "jul", "aoû", "sep", "oct", "nov", "déc",
] as const;

const MONTHS_FR_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

/**
 * `19 mai 2026` — the canonical date string for every Telegram header
 * and footer. Pick "abbr" for tight headers ("19 mai 2026") or "long"
 * for body prose ("19 mai 2026" with full month name — same here because
 * "mai" is both abbreviated and full form, but other months differ:
 * "fév" vs "février").
 */
export function formatDateFR(d: Date = new Date(), style: "abbr" | "long" = "abbr"): string {
  const day = d.getDate();
  const month = (style === "long" ? MONTHS_FR_LONG : MONTHS_FR)[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/** `🔧 <b>DogShift Maintenance — 19 mai 2026</b>` */
export function tgHeader(emoji: string, title: string, date: Date = new Date()): string {
  return `${emoji} <b>${title} — ${formatDateFR(date)}</b>`;
}

/** `🚨 <b>Section Title</b>` — used at the top of each block. */
export function tgSection(emoji: string, title: string): string {
  return `${emoji} <b>${title}</b>`;
}

/** Auto-pluralize: `pluralFR(2, "régression")` → `"2 régressions"`. */
export function pluralFR(n: number, singular: string, plural?: string): string {
  return `${n} ${n === 1 ? singular : plural ?? singular + "s"}`;
}

/** `<i>Généré automatiquement · 19 mai 2026</i>` */
export function tgFooter(date: Date = new Date()): string {
  return `<i>Généré automatiquement · ${formatDateFR(date)}</i>`;
}

/**
 * Join an ordered list of sections (each a string or array of lines)
 * with a single blank line between sections. Drops empty sections.
 *
 * Each section can be either:
 *   - a string (single line)
 *   - an array of strings (multiple lines, no extra spacing within)
 *   - null/undefined (skipped — useful for "show this section only if X")
 */
export function tgMessage(sections: Array<string | string[] | null | undefined>): string {
  const blocks = sections
    .filter((s): s is string | string[] => s != null)
    .map((s) => (Array.isArray(s) ? s.join("\n") : s))
    .filter((s) => s.length > 0);
  return blocks.join("\n\n");
}

/** Escape `& < >` for safe interpolation inside an HTML-parsed Telegram message. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    return c;
  });
}

/** Color-code a risk level the same way the admin panel does. */
export function riskEmoji(risk: "high" | "medium" | "low" | "none" | string): string {
  if (risk === "high") return "🔴";
  if (risk === "medium") return "🟡";
  if (risk === "low") return "🟢";
  return "⚪";
}

/** Numerical urgency rank used to sort an unsorted package list. */
export function riskRank(risk: "high" | "medium" | "low" | "none" | string): number {
  if (risk === "high") return 0;
  if (risk === "medium") return 1;
  if (risk === "low") return 2;
  return 3;
}
