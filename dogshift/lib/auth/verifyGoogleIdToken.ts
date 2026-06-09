/**
 * Server-side verification of a Google ID token obtained from the NATIVE Google
 * Sign-In SDK (Capacitor @capgo/capacitor-social-login).
 *
 * Why: Google blocks OAuth inside embedded WebViews (`disallowed_useragent`),
 * so the native app can't use the redirect-based Google provider. Instead it
 * signs in with the native SDK, gets an ID token, and posts it to the
 * "google-native" Credentials provider in `auth.ts`, which calls this helper.
 *
 * The pure `validateGooglePayload` is split out so it can be unit-tested
 * without a network round-trip.
 */
import { OAuth2Client, type TokenPayload } from "google-auth-library";

export type GoogleIdentity = {
  email: string;
  name: string | null;
  picture: string | null;
  googleSub: string;
};

const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

/**
 * Validate the decoded claims of a Google ID token against our allowed
 * audiences. Pure (no I/O) so it is unit-testable.
 *
 * Returns a normalized identity, or null if any check fails.
 */
export function validateGooglePayload(
  payload: TokenPayload | undefined | null,
  allowedAudiences: string[],
): GoogleIdentity | null {
  if (!payload) return null;

  // Issuer must be Google.
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) return null;

  // Audience must be one of OUR client IDs (web or iOS).
  const audiences = allowedAudiences.filter(Boolean);
  if (audiences.length === 0) return null;
  if (!payload.aud || !audiences.includes(payload.aud)) return null;

  // Must carry a verified email.
  if (!payload.email || payload.email_verified !== true) return null;

  // Stable Google user id.
  if (!payload.sub) return null;

  return {
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || null,
    picture: payload.picture || null,
    googleSub: payload.sub,
  };
}

/**
 * The Google client IDs we accept ID tokens for: the web OAuth client (used by
 * the browser flow + as the native SDK's `iOSServerClientId`) and the iOS
 * OAuth client. Both are non-secret.
 */
export function allowedGoogleAudiences(): string[] {
  const web = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "";
  const ios = process.env.AUTH_GOOGLE_IOS_ID || "";
  return [web, ios].filter(Boolean);
}

/**
 * Verify a Google ID token's signature + claims and return a normalized
 * identity, or null if invalid. Throws only on unexpected/internal errors.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  if (!idToken) return null;
  const audiences = allowedGoogleAudiences();
  if (audiences.length === 0) return null;

  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken, audience: audiences });
  return validateGooglePayload(ticket.getPayload(), audiences);
}
