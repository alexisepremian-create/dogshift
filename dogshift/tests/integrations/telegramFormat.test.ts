import { test } from "node:test";
import assert from "node:assert/strict";

import {
  escapeHtml,
  formatDateFR,
  pluralFR,
  riskEmoji,
  riskRank,
  tgFooter,
  tgHeader,
  tgMessage,
  tgSection,
} from "../../lib/telegram/format.ts";

test("formatDateFR returns French abbreviated form", () => {
  assert.equal(formatDateFR(new Date("2026-05-19T10:00:00Z")), "19 mai 2026");
  assert.equal(formatDateFR(new Date("2026-02-03T10:00:00Z")), "3 fév 2026");
});

test("formatDateFR long style uses full month names", () => {
  assert.equal(formatDateFR(new Date("2026-02-03T10:00:00Z"), "long"), "3 février 2026");
});

test("tgHeader produces the canonical header line", () => {
  const out = tgHeader("🔧", "DogShift Maintenance", new Date("2026-05-19T10:00:00Z"));
  assert.equal(out, "🔧 <b>DogShift Maintenance — 19 mai 2026</b>");
});

test("tgSection produces a bold section header", () => {
  assert.equal(tgSection("⚙️", "Agents (24h)"), "⚙️ <b>Agents (24h)</b>");
});

test("pluralFR auto-pluralizes", () => {
  assert.equal(pluralFR(0, "régression"), "0 régressions");
  assert.equal(pluralFR(1, "régression"), "1 régression");
  assert.equal(pluralFR(2, "régression"), "2 régressions");
  assert.equal(pluralFR(2, "régression", "régressions détectées"), "2 régressions détectées");
});

test("tgMessage joins sections with blank lines + skips null/empty", () => {
  const out = tgMessage([
    "Header",
    null,
    ["Section title", "Section body"],
    undefined,
    "Footer",
  ]);
  assert.equal(out, "Header\n\nSection title\nSection body\n\nFooter");
});

test("escapeHtml escapes & < > but not quotes", () => {
  assert.equal(escapeHtml("a & b < c > d \" e"), "a &amp; b &lt; c &gt; d \" e");
});

test("riskEmoji maps risk to color", () => {
  assert.equal(riskEmoji("high"), "🔴");
  assert.equal(riskEmoji("medium"), "🟡");
  assert.equal(riskEmoji("low"), "🟢");
  assert.equal(riskEmoji("unknown"), "⚪");
});

test("riskRank orders high before medium before low", () => {
  assert.ok(riskRank("high") < riskRank("medium"));
  assert.ok(riskRank("medium") < riskRank("low"));
  assert.ok(riskRank("low") < riskRank("unknown"));
});

test("tgFooter is the canonical footer line", () => {
  const out = tgFooter(new Date("2026-05-19T10:00:00Z"));
  assert.equal(out, "<i>Généré automatiquement · 19 mai 2026</i>");
});
