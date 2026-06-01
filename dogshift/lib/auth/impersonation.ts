/**
 * Admin impersonation toolkit.
 *
 * Lets a verified admin browse the platform as any non-admin user (sitter or
 * owner) for live debugging — exactly what Sonia's "Accepter le règlement
 * DogShift" bug would have needed to reproduce in 30 seconds instead of two
 * months. The admin's own session stays intact; we layer an HMAC-signed
 * shadow-session cookie on top.
 *
 * Three concerns live here so they can be reused across the edge middleware,
 * Node route handlers, and the React layout:
 *
 *   1. Cookie name + TTL (35 min, slightly longer than the 30-min UI banner
 *      countdown so the user has buffer to click "Quit" before the cookie
 *      hard-expires server-side).
 *   2. HMAC sign + verify, written against Web Crypto so the same helpers
 *      work in `proxy.ts` (edge runtime, no Node crypto) AND in Node API
 *      routes.
 *   3. The blocklist of sensitive actions that we forbid in impersonation
 *      mode (sending messages, paying, deleting, …) per the "Lecture +
 *      actions safe" mode the user picked when planning this feature.
 */

import type { Role } from "@prisma/client";

export const IMPERSONATION_COOKIE = "ds_impersonate";
export const IMPERSONATION_TTL_MS = 35 * 60 * 1000;

export type ImpersonationPayload = {
  /** DB id of the admin who started the session. */
  adminId: string;
  /** Email of the admin (denormalised for audit + banner display). */
  adminEmail: string;
  /** DB id of the user being impersonated (the "target"). */
  targetUserId: string;
  /** Email of the target (banner display). */
  targetEmail: string;
  /** Role of the target — informational; never "ADMIN" (start endpoint refuses). */
  targetRole: Role;
  /** Epoch ms when the session began. */
  startedAt: number;
  /** Epoch ms after which the cookie is considered expired regardless of browser TTL. */
  expiresAt: number;
};

// ── Sensitive routes blocked in impersonation mode ───────────────────────────
//
// Each entry is matched against the request method + pathname. A match means
// "this action is forbidden while impersonating" — the middleware will respond
// with 403 IMPERSONATION_FORBIDDEN_ACTION. Routes not listed here are allowed
// (lecture + actions safe). When in doubt, ADD a route here rather than
// leaving it allowed — blocking too much is a UX paper cut, blocking too
// little is an audit/RGPD incident.
type BlockedRoute = { method: "ANY" | "POST" | "PATCH" | "PUT" | "DELETE"; pattern: RegExp };

export const IMPERSONATION_BLOCKED_ROUTES: readonly BlockedRoute[] = [
  // Messaging — never send a message in someone else's name
  { method: "POST", pattern: /^\/api\/account\/messages(\/|$)/ },
  { method: "POST", pattern: /^\/api\/host\/messages(\/|$)/ },

  // Stripe and any payment-flow side effect
  { method: "ANY", pattern: /^\/api\/host\/stripe(\/|$)/ },
  { method: "ANY", pattern: /^\/api\/stripe(\/|$)/ },

  // Account / data deletion
  { method: "POST", pattern: /^\/api\/account\/delete(\/|$)/ },
  { method: "DELETE", pattern: /.*/ },

  // Reservations: never accept/decline/cancel or create on someone's behalf
  { method: "POST", pattern: /^\/api\/bookings(\/|$)/ },
  { method: "POST", pattern: /^\/api\/host\/requests\/[^/]+\/(accept|decline|cancel-confirmed)$/ },
  { method: "POST", pattern: /^\/api\/account\/bookings\/[^/]+\/cancel$/ },

  // Auth-identity actions (passwords, email verification)
  { method: "POST", pattern: /^\/api\/auth\/set-password(\/|$)/ },
  { method: "POST", pattern: /^\/api\/auth\/forgot-password(\/|$)/ },
  { method: "POST", pattern: /^\/api\/auth\/reset-password(\/|$)/ },
  { method: "POST", pattern: /^\/api\/account\/email-verification(\/|$)/ },

  // Reviews — would create reputation on someone's behalf
  { method: "POST", pattern: /^\/api\/reviews(\/|$)/ },
];

/**
 * Pure predicate, safe in both edge + node. Used by the middleware to decide
 * whether to early-403, and by tests to lock the contract.
 */
export function isBlockedInImpersonation(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  for (const route of IMPERSONATION_BLOCKED_ROUTES) {
    if (route.method !== "ANY" && route.method !== m) continue;
    if (route.pattern.test(pathname)) return true;
  }
  return false;
}

// ── HMAC sign / verify via Web Crypto (edge-compatible) ──────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Token format: `<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`.
 * No prefix/version byte — if we ever rotate the format, we'll just bump
 * the cookie name (`ds_impersonate2`) and read both for a grace window.
 */
export async function signImpersonationToken(
  payload: ImpersonationPayload,
  secret: string,
): Promise<string> {
  if (!secret || secret.length < 16) {
    throw new Error("signImpersonationToken: secret must be >= 16 chars");
  }
  const json = JSON.stringify(payload);
  const body = base64urlEncode(new TextEncoder().encode(json));
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${base64urlEncode(new Uint8Array(sig))}`;
}

/**
 * Verifies HMAC + expiry. Returns null on any failure (bad format, bad MAC,
 * expired, malformed JSON, missing required field). Callers should NEVER
 * trust a token whose verification returned null.
 */
export async function verifyImpersonationToken(
  token: string | undefined | null,
  secret: string,
): Promise<ImpersonationPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  try {
    const [body, sig] = parts;
    const key = await getHmacKey(secret);
    const sigBytes = base64urlDecode(sig);
    // Copy into a fresh ArrayBuffer so the type system is happy across
    // Uint8Array<ArrayBuffer | SharedArrayBuffer> variants.
    const sigBuf = new ArrayBuffer(sigBytes.byteLength);
    new Uint8Array(sigBuf).set(sigBytes);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuf,
      new TextEncoder().encode(body),
    );
    if (!valid) return null;

    const json = new TextDecoder().decode(base64urlDecode(body));
    const payload = JSON.parse(json) as unknown;
    if (!isImpersonationPayload(payload)) return null;
    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}

function isImpersonationPayload(v: unknown): v is ImpersonationPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.adminId === "string" &&
    typeof o.adminEmail === "string" &&
    typeof o.targetUserId === "string" &&
    typeof o.targetEmail === "string" &&
    typeof o.targetRole === "string" &&
    typeof o.startedAt === "number" &&
    typeof o.expiresAt === "number" &&
    o.targetRole !== "ADMIN"
  );
}

/**
 * Reads the secret used for impersonation signing. Same env var as Auth.js so
 * we don't multiply secrets — the cookie is bound to the same trust root as
 * the session itself.
 */
export function getImpersonationSecret(): string {
  const s = process.env.AUTH_SECRET ?? "";
  if (!s) {
    // Fail loud — in any env where the lib is used, AUTH_SECRET MUST be set.
    // Returning an empty string would let an attacker forge tokens.
    throw new Error("AUTH_SECRET is not set — impersonation signing is unsafe without it");
  }
  return s;
}
