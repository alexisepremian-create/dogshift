import test from "node:test";
import assert from "node:assert/strict";

import {
  activationCodeEmailDefaultPreviewText,
  activationCodeEmailPlainText,
  activationCodeEmailSubject,
  formatActivationCodeExpiry,
} from "../../lib/email/templates/activationCodeEmailContent.ts";

// ---------------------------------------------------------------------------
// Subject / preview
// ---------------------------------------------------------------------------

test("activationCodeEmailSubject is a stable, human readable French string", () => {
  const subject = activationCodeEmailSubject();
  assert.match(subject, /contrat/i);
  assert.match(subject, /code/i);
  assert.match(subject, /DogShift/);
});

test("activationCodeEmailDefaultPreviewText is under 130 chars (inbox preview)", () => {
  const preview = activationCodeEmailDefaultPreviewText();
  assert.ok(preview.length > 0);
  assert.ok(preview.length <= 130, `preview is ${preview.length} chars, should be <=130`);
});

// ---------------------------------------------------------------------------
// Plain-text body
// ---------------------------------------------------------------------------

test("activationCodeEmailPlainText greets the sitter by first name when provided", () => {
  const body = activationCodeEmailPlainText({
    firstName: "Alexis",
    activationCode: "DS-8H3K-Q9M2",
  });
  assert.match(body, /^Bonjour Alexis,/);
});

test("activationCodeEmailPlainText falls back to a generic greeting when firstName missing", () => {
  const body = activationCodeEmailPlainText({
    firstName: "",
    activationCode: "DS-8H3K-Q9M2",
  });
  assert.match(body, /^Bonjour,/);
});

test("activationCodeEmailPlainText renders the activation code on its own indented line", () => {
  const code = "DS-8H3K-Q9M2";
  const body = activationCodeEmailPlainText({
    firstName: "Alexis",
    activationCode: code,
  });
  // The code must appear on its own indented line in the body section.
  // It also appears in the CTA URL, so we check for the indented line form.
  assert.match(body, new RegExp(`\\n\\s+${code}\\n`));
});

test("activationCodeEmailPlainText links to /become-sitter/access with the code on the provided baseUrl", () => {
  const body = activationCodeEmailPlainText({
    firstName: "Alexis",
    activationCode: "DS-8H3K-Q9M2",
    baseUrl: "https://preview.dogshift.ch/",
  });
  assert.match(body, /https:\/\/preview\.dogshift\.ch\/become-sitter\/access\?code=/);
});

test("activationCodeEmailPlainText falls back to dogshift.ch when no baseUrl is supplied", () => {
  const body = activationCodeEmailPlainText({
    firstName: "Alexis",
    activationCode: "DS-8H3K-Q9M2",
  });
  assert.match(body, /https:\/\/www\.dogshift\.ch\/become-sitter\/access\?code=/);
});

test("activationCodeEmailPlainText mentions the expiry date in French when expiresAt is provided", () => {
  const body = activationCodeEmailPlainText({
    firstName: "Alexis",
    activationCode: "DS-8H3K-Q9M2",
    expiresAt: new Date("2026-05-01T10:00:00.000Z"),
  });
  assert.match(body, /valable jusqu'au/);
  assert.match(body, /2026/);
});

test("activationCodeEmailPlainText omits the expiry line when expiresAt is missing", () => {
  const body = activationCodeEmailPlainText({
    firstName: "Alexis",
    activationCode: "DS-8H3K-Q9M2",
    expiresAt: null,
  });
  assert.doesNotMatch(body, /valable jusqu'au/);
});

test("activationCodeEmailPlainText always signs off with the DogShift team + support email", () => {
  const body = activationCodeEmailPlainText({
    firstName: "Alexis",
    activationCode: "DS-8H3K-Q9M2",
  });
  assert.match(body, /— L'équipe DogShift/);
  assert.match(body, /support@dogshift\.ch/);
});

// ---------------------------------------------------------------------------
// Expiry formatter
// ---------------------------------------------------------------------------

test("formatActivationCodeExpiry returns null for missing or invalid inputs", () => {
  assert.equal(formatActivationCodeExpiry(null), null);
  assert.equal(formatActivationCodeExpiry(undefined), null);
  assert.equal(formatActivationCodeExpiry(""), null);
  assert.equal(formatActivationCodeExpiry("not-a-date"), null);
});

test("formatActivationCodeExpiry renders a fr-CH long date for valid inputs", () => {
  const formatted = formatActivationCodeExpiry(new Date("2026-05-01T10:00:00.000Z"));
  assert.ok(formatted);
  // We don't pin the exact string (Intl output varies across Node versions)
  // but it must contain the year and a French month name.
  assert.match(formatted!, /2026/);
  assert.match(formatted!, /mai/i);
});
