import { test } from "node:test";
import assert from "node:assert/strict";

import type { SendEmailAudit, SendEmailInput } from "../../lib/email/sendEmail.ts";

// `sendEmail` itself is hard to unit-test because it hits Resend/SMTP. We
// instead lock the audit type contract — every change to it should land
// with an explicit decision in this test, since 35+ call sites depend on
// it being backwards-compatible.

test("SendEmailAudit fields are all optional", () => {
  // This compiles iff the type accepts {} — protects against accidentally
  // making a field required, which would break every existing untagged caller.
  const a: SendEmailAudit = {};
  assert.ok(a);
});

test("SendEmailAudit accepts all expected fields", () => {
  const a: SendEmailAudit = {
    templateName: "inactivity-warning-1",
    context: "cron:inactivity-check",
    targetUserId: "usr_abc",
    metadata: { sitterId: "stt_x", daysUntilWarning2: 7 },
  };
  assert.equal(a.templateName, "inactivity-warning-1");
  assert.equal(a.context, "cron:inactivity-check");
  assert.equal(a.targetUserId, "usr_abc");
  assert.deepEqual(a.metadata, { sitterId: "stt_x", daysUntilWarning2: 7 });
});

test("SendEmailInput shape is unchanged (backwards compat for 35+ callers)", () => {
  const input: SendEmailInput = {
    to: "user@example.com",
    subject: "Hello",
    text: "Body",
    html: "<p>Body</p>",
    headers: { "x-foo": "bar" },
  };
  assert.equal(input.to, "user@example.com");
  // Crucially : html + headers stay OPTIONAL. If they ever become required
  // we'd silently break a bunch of crons.
  const minimal: SendEmailInput = { to: "x@y.com", subject: "s", text: "t" };
  assert.ok(minimal);
});

test("targetUserId accepts null (so callers can pass `userId ?? null` cleanly)", () => {
  const a: SendEmailAudit = { targetUserId: null };
  assert.equal(a.targetUserId, null);
});
