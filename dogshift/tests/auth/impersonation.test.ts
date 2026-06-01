import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IMPERSONATION_TTL_MS,
  signImpersonationToken,
  verifyImpersonationToken,
  type ImpersonationPayload,
} from "../../lib/auth/impersonation.ts";

// HMAC-SHA256 over base64url-encoded JSON payload. The verify path must:
//   - reject tampered MAC
//   - reject expired payloads
//   - reject malformed input
//   - reject payloads whose targetRole is "ADMIN" (defense in depth)
//   - round-trip valid payloads byte-for-byte
//
// These tests are the security floor for the impersonation feature: if any
// of them flips to passing-when-it-shouldn't, an attacker could forge a
// shadow session.

const SECRET = "abcdefghijklmnopqrstuvwxyz123456"; // 32 chars, >= 16 required

function makePayload(overrides: Partial<ImpersonationPayload> = {}): ImpersonationPayload {
  const now = Date.now();
  return {
    adminId: "usr_admin",
    adminEmail: "admin@example.com",
    targetUserId: "usr_target",
    targetEmail: "sonia@example.com",
    targetRole: "SITTER",
    startedAt: now,
    expiresAt: now + IMPERSONATION_TTL_MS,
    ...overrides,
  };
}

test("signImpersonationToken refuses a short secret", async () => {
  await assert.rejects(
    () => signImpersonationToken(makePayload(), "short"),
    /secret must be/,
  );
});

test("valid token round-trips", async () => {
  const payload = makePayload();
  const token = await signImpersonationToken(payload, SECRET);
  const verified = await verifyImpersonationToken(token, SECRET);
  assert.ok(verified);
  assert.equal(verified.adminId, payload.adminId);
  assert.equal(verified.targetUserId, payload.targetUserId);
  assert.equal(verified.targetRole, "SITTER");
});

test("token signed with secret A is rejected by secret B", async () => {
  const token = await signImpersonationToken(makePayload(), SECRET);
  const verified = await verifyImpersonationToken(
    token,
    "DIFFERENTSECRET_DIFFERENTSECRET_X",
  );
  assert.equal(verified, null);
});

test("tampered MAC is rejected", async () => {
  const token = await signImpersonationToken(makePayload(), SECRET);
  // Flip a char in the MIDDLE of the MAC portion. Flipping the last char of
  // a base64url string is unreliable because trailing bits can round-trip to
  // the same bytes; a middle char always lands inside a full sextet.
  const [body, sig] = token.split(".");
  const i = Math.floor(sig.length / 2);
  const original = sig[i];
  const flipped = original === "A" ? "B" : "A";
  const tampered = sig.slice(0, i) + flipped + sig.slice(i + 1);
  const verified = await verifyImpersonationToken(`${body}.${tampered}`, SECRET);
  assert.equal(verified, null);
});

test("expired token is rejected", async () => {
  const payload = makePayload({ expiresAt: Date.now() - 1000 });
  const token = await signImpersonationToken(payload, SECRET);
  const verified = await verifyImpersonationToken(token, SECRET);
  assert.equal(verified, null, "expired tokens must verify as null");
});

test("token with targetRole=ADMIN is rejected (defense in depth)", async () => {
  const payload = makePayload({ targetRole: "ADMIN" as ImpersonationPayload["targetRole"] });
  const token = await signImpersonationToken(payload, SECRET);
  const verified = await verifyImpersonationToken(token, SECRET);
  assert.equal(
    verified,
    null,
    "an admin target must never pass verification, even if the start endpoint somehow let one through",
  );
});

test("malformed token (no dot) is rejected", async () => {
  const verified = await verifyImpersonationToken("not-a-token", SECRET);
  assert.equal(verified, null);
});

test("empty / null / undefined tokens are rejected", async () => {
  assert.equal(await verifyImpersonationToken("", SECRET), null);
  assert.equal(await verifyImpersonationToken(null, SECRET), null);
  assert.equal(await verifyImpersonationToken(undefined, SECRET), null);
});

test("token without secret is rejected", async () => {
  const token = await signImpersonationToken(makePayload(), SECRET);
  assert.equal(await verifyImpersonationToken(token, ""), null);
});

test("token with truncated body is rejected", async () => {
  const token = await signImpersonationToken(makePayload(), SECRET);
  const [body, sig] = token.split(".");
  const truncated = body.slice(0, body.length - 10);
  const verified = await verifyImpersonationToken(`${truncated}.${sig}`, SECRET);
  assert.equal(verified, null);
});
