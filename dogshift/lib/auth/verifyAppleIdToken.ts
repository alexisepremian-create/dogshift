/**
 * Server-side verification of an Apple identity token from the NATIVE Sign in
 * with Apple flow (Capacitor @capgo/capacitor-social-login).
 *
 * Like Google, Apple OAuth can't run in an embedded WebView, so the native app
 * uses ASAuthorization, gets an identity token (a JWT signed by Apple), and
 * posts it to the "apple-native" Credentials provider in `auth.ts`, which calls
 * this helper.
 *
 * Native vs web audience: for a NATIVE app the token's `aud` is the app's
 * **bundle id** (`ch.dogshift.app`), NOT the web Services ID
 * (`ch.dogshift.app.signin`) used by the redirect flow.
 *
 * `extractAppleIdentity` (pure) is split out for unit testing; signature +
 * iss/aud/exp checks are done by `jose.jwtVerify`.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AppleIdentity = {
  email: string;
  appleSub: string;
};

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

/** The native audience = the iOS app bundle id (overridable via env). */
export function appleNativeAudience(): string {
  return process.env.AUTH_APPLE_NATIVE_AUD || "ch.dogshift.app";
}

/**
 * Pure extraction of the identity from already-verified Apple claims. Returns
 * null if the required claims (verified email + sub) are missing. Apple marks
 * `email_verified` as the string "true" or a boolean depending on the flow.
 */
export function extractAppleIdentity(payload: JWTPayload | null | undefined): AppleIdentity | null {
  if (!payload) return null;

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return null;

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : null;
  if (!email) return null;

  const verifiedClaim = (payload as { email_verified?: unknown }).email_verified;
  const emailVerified = verifiedClaim === true || verifiedClaim === "true";
  if (!emailVerified) return null;

  return { email, appleSub: sub };
}

/**
 * Verify an Apple identity token (signature via Apple's JWKS + iss/aud/exp) and
 * return a normalized identity, or null if invalid.
 */
export async function verifyAppleIdToken(idToken: string): Promise<AppleIdentity | null> {
  if (!idToken) return null;
  try {
    const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: appleNativeAudience(),
    });
    return extractAppleIdentity(payload);
  } catch {
    return null;
  }
}
