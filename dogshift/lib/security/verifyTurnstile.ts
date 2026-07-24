/**
 * Server-side verification of a Cloudflare Turnstile token.
 *
 * Env-gated: if TURNSTILE_SECRET_KEY is not set, verification is SKIPPED
 * (returns ok) so the app keeps working exactly as before until the founder
 * configures Turnstile in the Cloudflare dashboard. Once the secret is set,
 * a missing/invalid token is rejected.
 *
 * NOTE: this is the widget-level "verify you are human" check — it is NOT the
 * full-page Cloudflare interstitial (that lives only in the Cloudflare
 * dashboard, at the edge, and cannot be changed from application code).
 */
const SECRET = process.env.TURNSTILE_SECRET_KEY;
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_SERVER_ENABLED = Boolean(SECRET);

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<{ ok: boolean; skipped?: boolean }> {
  // Not configured → no-op (don't block anyone).
  if (!SECRET) return { ok: true, skipped: true };
  if (!token || typeof token !== "string") return { ok: false };

  try {
    const body = new URLSearchParams();
    body.set("secret", SECRET);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    return { ok: Boolean(data?.success) };
  } catch {
    // Cloudflare unreachable — fail closed only when configured, but don't
    // hard-crash the request path.
    return { ok: false };
  }
}
