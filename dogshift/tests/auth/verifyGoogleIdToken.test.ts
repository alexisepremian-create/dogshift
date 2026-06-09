/**
 * Regression: claims validation for native Google Sign-In ID tokens.
 *
 * `validateGooglePayload` (lib/auth/verifyGoogleIdToken.ts) is the pure gate
 * that decides whether a decoded Google ID token is acceptable. The signature
 * check happens in google-auth-library; this covers the claim rules:
 *   - issuer must be Google
 *   - audience must be one of our client IDs
 *   - email must be present AND verified
 *   - sub (stable Google id) must be present
 */
import test from "node:test";
import assert from "node:assert/strict";

import { validateGooglePayload } from "../../lib/auth/verifyGoogleIdToken.ts";

const WEB = "web-client-id.apps.googleusercontent.com";
const IOS = "ios-client-id.apps.googleusercontent.com";
const AUD = [WEB, IOS];

function base() {
  return {
    iss: "https://accounts.google.com",
    aud: WEB,
    sub: "1234567890",
    email: "Alex@Example.com",
    email_verified: true,
    name: "Alex Doe",
    picture: "https://example.com/a.png",
  };
}

test("valid payload → normalized identity (email lowercased)", () => {
  const id = validateGooglePayload(base(), AUD);
  assert.deepEqual(id, {
    email: "alex@example.com",
    name: "Alex Doe",
    picture: "https://example.com/a.png",
    googleSub: "1234567890",
  });
});

test("accepts the iOS audience too", () => {
  const id = validateGooglePayload({ ...base(), aud: IOS }, AUD);
  assert.equal(id?.email, "alex@example.com");
});

test("rejects a foreign audience", () => {
  assert.equal(validateGooglePayload({ ...base(), aud: "someone-else" }, AUD), null);
});

test("rejects a non-Google issuer", () => {
  assert.equal(validateGooglePayload({ ...base(), iss: "evil.com" }, AUD), null);
});

test("rejects an unverified email", () => {
  assert.equal(validateGooglePayload({ ...base(), email_verified: false }, AUD), null);
});

test("rejects a missing email", () => {
  assert.equal(validateGooglePayload({ ...base(), email: undefined }, AUD), null);
});

test("rejects a missing sub", () => {
  assert.equal(validateGooglePayload({ ...base(), sub: undefined }, AUD), null);
});

test("rejects when no allowed audiences are configured", () => {
  assert.equal(validateGooglePayload(base(), []), null);
});

test("rejects a null payload", () => {
  assert.equal(validateGooglePayload(null, AUD), null);
});
