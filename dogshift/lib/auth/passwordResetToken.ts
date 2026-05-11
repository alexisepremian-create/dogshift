/**
 * Password reset token helpers — DogShift.
 *
 * Tokens are 32 random bytes (hex). The plaintext is sent in the email link;
 * only its SHA-256 hash is persisted (in `VerificationToken.token`) so that a
 * DB leak does not give an attacker valid reset links.
 *
 * `identifier` carries the email scope: `password-reset:<email>` to keep
 * password reset tokens distinct from future magic-link / email-verification
 * tokens that share the same table.
 */
import crypto from "node:crypto";

const RESET_TTL_MS = 60 * 60 * 1000; // 1h

export function generateResetToken(): { plaintext: string; hash: string } {
  const plaintext = crypto.randomBytes(32).toString("hex");
  const hash = hashResetToken(plaintext);
  return { plaintext, hash };
}

export function hashResetToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function resetTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESET_TTL_MS);
}

export function resetTokenIdentifier(email: string): string {
  return `password-reset:${email.trim().toLowerCase()}`;
}
