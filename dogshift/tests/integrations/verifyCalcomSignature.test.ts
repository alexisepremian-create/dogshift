import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { verifyCalcomSignature } from "../../lib/calcom/verifyCalcomSignature.ts";

const SECRET = "test-secret-do-not-use-in-prod";
const RAW = JSON.stringify({
  triggerEvent: "BOOKING_CREATED",
  payload: { uid: "abc123", attendees: [{ name: "Marie", email: "marie@example.com" }] },
});

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

test("verifyCalcomSignature: accepts a valid signature", () => {
  const result = verifyCalcomSignature({
    rawBody: RAW,
    signatureHeader: sign(RAW),
    secret: SECRET,
  });
  assert.deepEqual(result, { ok: true });
});

test("verifyCalcomSignature: accepts uppercase hex header (Cal.com is case-insensitive on hex)", () => {
  const upper = sign(RAW).toUpperCase();
  const result = verifyCalcomSignature({
    rawBody: RAW,
    signatureHeader: upper,
    secret: SECRET,
  });
  assert.deepEqual(result, { ok: true });
});

test("verifyCalcomSignature: rejects when the secret is missing on the server", () => {
  const result = verifyCalcomSignature({
    rawBody: RAW,
    signatureHeader: sign(RAW),
    secret: undefined,
  });
  assert.deepEqual(result, { ok: false, reason: "MISSING_SECRET" });
});

test("verifyCalcomSignature: rejects when the header is missing", () => {
  const result = verifyCalcomSignature({
    rawBody: RAW,
    signatureHeader: null,
    secret: SECRET,
  });
  assert.deepEqual(result, { ok: false, reason: "MISSING_SIGNATURE" });
});

test("verifyCalcomSignature: rejects when the signature doesn't match the body", () => {
  // Compute signature over a DIFFERENT body, then send the real body
  const wrongSig = sign(RAW + "tampered");
  const result = verifyCalcomSignature({
    rawBody: RAW,
    signatureHeader: wrongSig,
    secret: SECRET,
  });
  assert.deepEqual(result, { ok: false, reason: "BAD_SIGNATURE" });
});

test("verifyCalcomSignature: rejects when the signature was signed with a different secret", () => {
  const wrongSig = sign(RAW, "another-secret");
  const result = verifyCalcomSignature({
    rawBody: RAW,
    signatureHeader: wrongSig,
    secret: SECRET,
  });
  assert.deepEqual(result, { ok: false, reason: "BAD_SIGNATURE" });
});

test("verifyCalcomSignature: rejects signature of wrong length without throwing", () => {
  // timingSafeEqual throws on unequal-length buffers — make sure we guard.
  const result = verifyCalcomSignature({
    rawBody: RAW,
    signatureHeader: "deadbeef",
    secret: SECRET,
  });
  assert.deepEqual(result, { ok: false, reason: "BAD_SIGNATURE" });
});
