/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Native push notifications — APNs (iOS) + FCM (Android).
 *
 * Distinct from lib/push/send.ts which handles Web Push (VAPID). The two
 * coexist : a user might have both a web push subscription and a native
 * push token registered on different devices.
 *
 * Implementation strategy : we don't use heavy SDKs (no firebase-admin,
 * no apn lib). Both APNs and FCM expose HTTP/2 endpoints we hit directly
 * with `fetch` — keeps the bundle small and avoids cold-start delays on
 * Vercel.
 *
 * Required env vars :
 *  - APNS_KEY_ID         : ABC123DEF4 (10 char Apple Key ID)
 *  - APNS_TEAM_ID        : XYZ987WVU6 (10 char Apple Team ID)
 *  - APNS_KEY_P8         : base64-encoded contents of the .p8 file
 *  - APNS_BUNDLE_ID      : ch.dogshift.app
 *  - APNS_USE_SANDBOX    : "1" for dev/TestFlight, "" for prod
 *  - FCM_SERVICE_ACCOUNT : base64-encoded service-account.json from Firebase console
 *  - FCM_PROJECT_ID      : dogshift-prod (Firebase project id)
 *
 * See docs/native-app.md for the full setup procedure.
 */

import { createSign } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type NativePushPayload = {
  title: string;
  body: string;
  /** Deep link URL ; the app opens this when the user taps the notification. */
  url?: string;
  /** Replaces same-tag notification (per-platform dedup key). */
  tag?: string;
  /** Badge count for iOS (Android ignores). */
  badge?: number;
  /** Custom data passed to the app. */
  data?: Record<string, unknown>;
};

/**
 * Sends a native push to every registered iOS + Android device for `userId`.
 * Returns counts. Auto-invalidates dead tokens (410 Gone / NotRegistered).
 */
export async function sendNativePushToUser(
  userId: string,
  payload: NativePushPayload,
): Promise<{ ios: number; android: number; failed: number }> {
  const result = { ios: 0, android: 0, failed: 0 };

  const tokens = await (prisma as any).nativePushToken.findMany({
    where: { userId, invalidatedAt: null },
  });
  if (tokens.length === 0) return result;

  for (const t of tokens) {
    try {
      if (t.platform === "ios") {
        const ok = await sendApns(t.token, payload);
        if (ok) result.ios += 1;
        else {
          await (prisma as any).nativePushToken.update({
            where: { id: t.id },
            data: { invalidatedAt: new Date() },
          });
          result.failed += 1;
        }
      } else if (t.platform === "android") {
        const ok = await sendFcm(t.token, payload);
        if (ok) result.android += 1;
        else {
          await (prisma as any).nativePushToken.update({
            where: { id: t.id },
            data: { invalidatedAt: new Date() },
          });
          result.failed += 1;
        }
      }
    } catch (err) {
      console.error("[native-push] send failed", { tokenId: t.id, platform: t.platform, err: String(err) });
      result.failed += 1;
    }
  }

  return result;
}

// ─── APNs (iOS) ────────────────────────────────────────────────────────────

let cachedApnsJwt: { token: string; expiresAt: number } | null = null;

function getApnsJwt(): string | null {
  const keyId = (process.env.APNS_KEY_ID ?? "").trim();
  const teamId = (process.env.APNS_TEAM_ID ?? "").trim();
  const p8Base64 = (process.env.APNS_KEY_P8 ?? "").trim();
  if (!keyId || !teamId || !p8Base64) return null;

  const now = Math.floor(Date.now() / 1000);
  // Apple recommends refreshing the JWT every ~50 min (1h max).
  if (cachedApnsJwt && cachedApnsJwt.expiresAt > now + 60) {
    return cachedApnsJwt.token;
  }

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const claims = { iss: teamId, iat: now };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const p8 = Buffer.from(p8Base64, "base64").toString("utf-8");
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(p8);
  const encodedSig = signature.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const jwt = `${signingInput}.${encodedSig}`;
  cachedApnsJwt = { token: jwt, expiresAt: now + 3000 };
  return jwt;
}

async function sendApns(deviceToken: string, payload: NativePushPayload): Promise<boolean> {
  const jwt = getApnsJwt();
  const bundleId = (process.env.APNS_BUNDLE_ID ?? "ch.dogshift.app").trim();
  if (!jwt || !bundleId) {
    console.warn("[native-push][apns] missing env (APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8, APNS_BUNDLE_ID)");
    return false;
  }

  const sandbox = process.env.APNS_USE_SANDBOX === "1";
  const host = sandbox ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const url = `https://${host}/3/device/${deviceToken}`;

  const apsPayload: Record<string, unknown> = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      ...(payload.tag ? { "thread-id": payload.tag } : {}),
    },
    ...(payload.url ? { url: payload.url } : {}),
    ...(payload.data ?? {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
      ...(payload.tag ? { "apns-collapse-id": payload.tag.slice(0, 64) } : {}),
    },
    body: JSON.stringify(apsPayload),
  });

  if (res.status === 200) return true;
  // 410 = device unregistered (uninstalled the app or revoked permission)
  // 400 BadDeviceToken = ditto, often a sandbox/prod env mismatch
  if (res.status === 410 || res.status === 400) {
    console.warn("[native-push][apns] token invalidated", { status: res.status });
    return false;
  }
  // 429 = rate limit. Retry later (we don't, just log).
  console.error("[native-push][apns] unexpected status", { status: res.status, body: await res.text().catch(() => "") });
  return false;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ─── FCM (Android) ─────────────────────────────────────────────────────────

let cachedFcmAccessToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(): Promise<string | null> {
  const saBase64 = (process.env.FCM_SERVICE_ACCOUNT ?? "").trim();
  if (!saBase64) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAt > now + 60) {
    return cachedFcmAccessToken.token;
  }

  let sa: { client_email: string; private_key: string; token_uri?: string };
  try {
    sa = JSON.parse(Buffer.from(saBase64, "base64").toString("utf-8"));
  } catch {
    console.error("[native-push][fcm] FCM_SERVICE_ACCOUNT is not valid base64-encoded JSON");
    return null;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(sa.private_key);
  const encodedSig = signature.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const assertion = `${signingInput}.${encodedSig}`;

  const tokenRes = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!tokenRes.ok) {
    console.error("[native-push][fcm] token exchange failed", { status: tokenRes.status });
    return null;
  }
  const j = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) return null;
  cachedFcmAccessToken = {
    token: j.access_token,
    expiresAt: now + (j.expires_in ?? 3600) - 60,
  };
  return j.access_token;
}

async function sendFcm(registrationToken: string, payload: NativePushPayload): Promise<boolean> {
  const projectId = (process.env.FCM_PROJECT_ID ?? "").trim();
  const token = await getFcmAccessToken();
  if (!token || !projectId) {
    console.warn("[native-push][fcm] missing env (FCM_PROJECT_ID, FCM_SERVICE_ACCOUNT)");
    return false;
  }

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const message: Record<string, unknown> = {
    token: registrationToken,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    android: {
      priority: "HIGH",
      notification: {
        ...(payload.tag ? { tag: payload.tag } : {}),
        click_action: "OPEN_APP",
      },
    },
    data: {
      ...(payload.url ? { url: payload.url } : {}),
      ...Object.fromEntries(
        Object.entries(payload.data ?? {}).map(([k, v]) => [k, String(v)]),
      ),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (res.ok) return true;
  // 404 / 410 = token no longer valid (uninstall, etc.)
  if (res.status === 404 || res.status === 410) {
    console.warn("[native-push][fcm] token invalidated", { status: res.status });
    return false;
  }
  console.error("[native-push][fcm] unexpected status", { status: res.status, body: await res.text().catch(() => "") });
  return false;
}
