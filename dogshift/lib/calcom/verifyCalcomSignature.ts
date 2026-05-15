/**
 * Verifies the HMAC-SHA256 signature that Cal.com sends with every webhook.
 *
 * Cal.com signs the *raw* request body with the secret configured on the
 * webhook (Settings → Developer → Webhooks → Secret) and sends the hex digest
 * in the `X-Cal-Signature-256` header. This module mirrors that computation
 * and compares in constant time.
 *
 * Returns an explicit reason on failure so the caller can log it without
 * leaking secret material.
 *
 * Reference: https://cal.com/docs/core-features/webhooks
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "MISSING_SECRET" | "MISSING_SIGNATURE" | "BAD_SIGNATURE" };

export function verifyCalcomSignature(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret: string | undefined;
}): VerifyResult {
  const secret = (params.secret ?? "").trim();
  if (!secret) return { ok: false, reason: "MISSING_SECRET" };

  const provided = (params.signatureHeader ?? "").trim().toLowerCase();
  if (!provided) return { ok: false, reason: "MISSING_SIGNATURE" };

  const expected = createHmac("sha256", secret).update(params.rawBody).digest("hex");

  // timingSafeEqual requires equal-length buffers. If they differ, short-circuit
  // to BAD_SIGNATURE so we don't throw on attacker-controlled lengths.
  if (provided.length !== expected.length) return { ok: false, reason: "BAD_SIGNATURE" };

  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (!timingSafeEqual(providedBuf, expectedBuf)) return { ok: false, reason: "BAD_SIGNATURE" };

  return { ok: true };
}
