import test from "node:test";
import assert from "node:assert/strict";

import {
  applicationStatusEmailPlainText,
  applicationStatusEmailSubject,
} from "../../lib/email/templates/applicationStatusEmailContent.ts";
import { sendApplicationEmailSchema } from "../../lib/sitterApplication/sendApplicationEmailSchema.ts";

// Note: we only cover the pure helpers (subject + plain-text) and the Zod schema
// here. The React Email component itself is validated at type-check time by tsc
// and at runtime by the route handler — Node's --experimental-strip-types does
// not support .tsx rendering, so we purposefully avoid importing the JSX body
// from this test (it would fail with ERR_UNKNOWN_FILE_EXTENSION).

// ---------------------------------------------------------------------------
// Subject helper
// ---------------------------------------------------------------------------

test("applicationStatusEmailSubject returns the HIGH celebration subject", () => {
  const subject = applicationStatusEmailSubject("HIGH");
  assert.match(subject, /Bienvenue/i);
  assert.match(subject, /entretien/i);
});

test("applicationStatusEmailSubject returns the REVIEW pending subject", () => {
  const subject = applicationStatusEmailSubject("REVIEW");
  assert.match(subject, /à l'étude/i);
});

test("applicationStatusEmailSubject returns the LOW neutral subject", () => {
  const subject = applicationStatusEmailSubject("LOW");
  assert.match(subject, /candidature/i);
  assert.doesNotMatch(subject, /Bienvenue/i);
});

// ---------------------------------------------------------------------------
// Plain-text renderer
// ---------------------------------------------------------------------------

test("applicationStatusEmailPlainText HIGH embeds the Calendly link", () => {
  const text = applicationStatusEmailPlainText({
    firstName: "Jeanne",
    lastName: "Dupont",
    status: "HIGH",
    calendlyLink: "https://calendly.com/dogshift/15min",
  });
  assert.match(text, /Jeanne/);
  assert.match(text, /entretien/i);
  assert.match(text, /15 minutes/);
  assert.match(text, /https:\/\/calendly\.com\/dogshift\/15min/);
});

test("applicationStatusEmailPlainText REVIEW announces the 5-day SLA", () => {
  const text = applicationStatusEmailPlainText({
    firstName: "Luca",
    lastName: "Rossi",
    status: "REVIEW",
  });
  assert.match(text, /5 jours ouvrables/i);
  assert.doesNotMatch(text, /calendly/i);
});

test("applicationStatusEmailPlainText LOW stays polite and gives no reason", () => {
  const text = applicationStatusEmailPlainText({
    firstName: "Amélie",
    lastName: "Martin",
    status: "LOW",
  });
  assert.match(text, /Merci/);
  assert.match(text, /phase pilote/i);
  assert.doesNotMatch(text, /calendly/i);
  // LOW must not announce a hard "5 days" SLA nor invite to an interview.
  assert.doesNotMatch(text, /entretien/i);
});

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

function baseBody() {
  return {
    firstName: "Jeanne",
    lastName: "Dupont",
    email: "jeanne@example.ch",
    status: "HIGH" as const,
    score: 85,
    calendlyLink: "https://calendly.com/dogshift/15min",
  };
}

test("sendApplicationEmailSchema accepts a well-formed HIGH payload", () => {
  const res = sendApplicationEmailSchema.safeParse(baseBody());
  assert.equal(res.success, true);
});

test("sendApplicationEmailSchema accepts REVIEW without calendlyLink", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    status: "REVIEW",
    calendlyLink: undefined,
  });
  assert.equal(res.success, true);
});

test("sendApplicationEmailSchema accepts LOW without calendlyLink", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    status: "LOW",
    calendlyLink: undefined,
  });
  assert.equal(res.success, true);
});

test("sendApplicationEmailSchema rejects HIGH without a calendlyLink", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    calendlyLink: undefined,
  });
  assert.equal(res.success, false);
  if (!res.success) {
    const hasCalendlyIssue = res.error.issues.some((i) =>
      i.path.includes("calendlyLink")
    );
    assert.equal(hasCalendlyIssue, true);
  }
});

test("sendApplicationEmailSchema rejects an unknown status", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    status: "MEDIUM",
  });
  assert.equal(res.success, false);
});

test("sendApplicationEmailSchema rejects score > 100", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    score: 250,
  });
  assert.equal(res.success, false);
});

test("sendApplicationEmailSchema rejects a malformed email", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    email: "not-an-email",
  });
  assert.equal(res.success, false);
});

test("sendApplicationEmailSchema rejects a non-URL calendlyLink", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    calendlyLink: "not-a-url",
  });
  assert.equal(res.success, false);
});

test("sendApplicationEmailSchema lowercases the email field", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    email: "JEANNE@Example.CH",
  });
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data.email, "jeanne@example.ch");
  }
});

test("sendApplicationEmailSchema accepts an optional applicationId", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    applicationId: "app_abc123",
  });
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data.applicationId, "app_abc123");
  }
});

test("sendApplicationEmailSchema still accepts payloads without applicationId (n8n backward compat)", () => {
  // Legacy n8n workflows don't echo back the applicationId yet. Their
  // payloads must keep validating so production email delivery never stalls
  // on a schema regression.
  const res = sendApplicationEmailSchema.safeParse(baseBody());
  assert.equal(res.success, true);
  if (res.success) {
    assert.equal(res.data.applicationId, undefined);
  }
});

test("sendApplicationEmailSchema rejects an empty-string applicationId", () => {
  const res = sendApplicationEmailSchema.safeParse({
    ...baseBody(),
    applicationId: "",
  });
  assert.equal(res.success, false);
});
