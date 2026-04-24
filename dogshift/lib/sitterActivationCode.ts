import { randomBytes } from "crypto";

import type { PrismaClient } from "@prisma/client";

import { hashActivationCode } from "./sitterContract.ts";

/**
 * Readable alphabet purposefully missing the visually ambiguous characters
 * 0/O, 1/I. Size is a power of two (32) so a single random byte can index it
 * via `byte & 31` with no modulo bias. Invariant enforced at module load.
 *
 * Composition: digits 2-9 (8) + letters A-Z minus I and O (24) = 32.
 */
export const ACTIVATION_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
if (ACTIVATION_CODE_ALPHABET.length !== 32) {
  throw new Error(
    `ACTIVATION_CODE_ALPHABET must be exactly 32 chars, got ${ACTIVATION_CODE_ALPHABET.length}`,
  );
}

/** Raw random body length (before dashes/prefix). Must equal alphabet-bit budget. */
export const ACTIVATION_CODE_BODY_LENGTH = 8;

/** 7 days, per product spec. Overridable via env for pilot tuning without a deploy. */
export const ACTIVATION_CODE_TTL_MS = (() => {
  const raw = (process.env.SITTER_ACTIVATION_CODE_TTL_DAYS || "").trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
  return days * 24 * 60 * 60 * 1000;
})();

const ACTIVATION_CODE_PREFIX = "DS";

/**
 * Generates a fresh activation code of the form `DS-XXXX-XXXX` drawn from
 * {@link ACTIVATION_CODE_ALPHABET}. The returned code is always the canonical
 * form used downstream — callers should not normalise further before hashing.
 */
export function generateActivationCode(): string {
  const bytes = randomBytes(ACTIVATION_CODE_BODY_LENGTH);
  let body = "";
  for (let i = 0; i < ACTIVATION_CODE_BODY_LENGTH; i += 1) {
    body += ACTIVATION_CODE_ALPHABET[bytes[i] & 31];
  }
  return `${ACTIVATION_CODE_PREFIX}-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

/**
 * Generates a fresh activation code, hashes it, and ensures no other
 * SitterProfile is already holding that hash. The probability of a true
 * collision on 32^8 ≈ 1.1e12 combinations is negligible, but the defensive
 * loop makes the uniqueness guaranteed by the @unique index a runtime
 * invariant instead of a crashing upsert.
 */
export async function generateUniqueActivationCode(
  prisma: PrismaClient,
  opts: { excludeSitterProfileId?: string | null; maxAttempts?: number } = {},
): Promise<{ rawCode: string; hash: string }> {
  const { excludeSitterProfileId = null, maxAttempts = 5 } = opts;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const rawCode = generateActivationCode();
    const hash = hashActivationCode(rawCode);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma client cast to reach SitterProfile dynamically.
    const clash = await (prisma as any).sitterProfile.findFirst({
      where: {
        activationCodeHash: hash,
        ...(excludeSitterProfileId ? { NOT: { id: excludeSitterProfileId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) {
      return { rawCode, hash };
    }
  }
  throw new Error("ACTIVATION_CODE_COLLISION");
}

/** Computes the expiry timestamp for a code issued at `issuedAt`. */
export function computeActivationCodeExpiresAt(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + ACTIVATION_CODE_TTL_MS);
}
