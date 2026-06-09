/**
 * Regression: claims extraction for native Sign in with Apple identity tokens.
 *
 * `extractAppleIdentity` (lib/auth/verifyAppleIdToken.ts) is the pure gate run
 * after jose has verified the signature + iss/aud/exp. It must:
 *   - require a `sub`
 *   - require an `email`
 *   - require `email_verified` (Apple sends it as boolean true OR string "true")
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { JWTPayload } from "jose";

import { extractAppleIdentity } from "../../lib/auth/verifyAppleIdToken.ts";

function claims(overrides: Record<string, unknown> = {}): JWTPayload {
  return {
    iss: "https://appleid.apple.com",
    aud: "ch.dogshift.app",
    sub: "000123.abcdef.0001",
    email: "Alex@Example.com",
    email_verified: "true",
    ...overrides,
  } as JWTPayload;
}

test("valid claims → identity (email lowercased)", () => {
  assert.deepEqual(extractAppleIdentity(claims()), {
    email: "alex@example.com",
    appleSub: "000123.abcdef.0001",
  });
});

test("accepts boolean email_verified", () => {
  assert.equal(extractAppleIdentity(claims({ email_verified: true }))?.email, "alex@example.com");
});

test("rejects unverified email", () => {
  assert.equal(extractAppleIdentity(claims({ email_verified: "false" })), null);
});

test("rejects missing email", () => {
  assert.equal(extractAppleIdentity(claims({ email: undefined })), null);
});

test("rejects missing sub", () => {
  assert.equal(extractAppleIdentity(claims({ sub: undefined })), null);
});

test("rejects null payload", () => {
  assert.equal(extractAppleIdentity(null), null);
});
