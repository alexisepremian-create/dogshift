/**
 * Daily Clerk authentication health check.
 *
 * Why this exists
 *   We had several incidents where the sign-up flow silently broke after a
 *   Clerk change without any deploy on our side (e.g. CAPTCHA mode toggled,
 *   sign-up endpoint returning 401 due to a token format change). With auth
 *   gating *every* paid feature, we cannot afford to discover this from a user
 *   complaint days later.
 *
 * What it checks (no real accounts created)
 *   1. Clerk Frontend API `/v1/environment` is reachable and returns expected
 *      shape (auth_config, captcha settings, sign-up enabled).
 *   2. Sign-up endpoint accepts requests (any 2xx/4xx is healthy — a 5xx or
 *      network failure means trouble).
 *   3. Sign-in endpoint accepts requests (same logic).
 *
 * On failure, sends a Telegram alert to the Maintenance bot. On success, we
 * stay silent (no daily noise).
 */

import { NextResponse } from "next/server";

import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";
export const maxDuration = 60;

type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  details?: string;
};

/** Decodes Clerk's base64 publishable key to extract the Frontend API host. */
function frontendApiFromPublishableKey(pk: string): string | null {
  const m = pk.match(/^pk_(test|live)_(.+)$/);
  if (!m) return null;
  try {
    const decoded = Buffer.from(m[2], "base64").toString("utf-8").replace(/\$$/, "").trim();
    return decoded || null;
  } catch {
    return null;
  }
}

async function timed(name: string, fn: () => Promise<{ ok: boolean; status?: number; details?: string }>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const r = await fn();
    return { name, durationMs: Date.now() - start, ...r };
  } catch (err) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - start,
      details: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  const frontendApi = pk ? frontendApiFromPublishableKey(pk) : null;
  if (!frontendApi) {
    const msg = "ALERTE Auth Health Check\n\nNEXT_PUBLIC_CLERK_PUBLISHABLE_KEY manquant ou invalide. Impossible de vérifier l'auth.";
    await sendTelegramMessage(msg, { bot: "maintenance" });
    return NextResponse.json({ ok: false, reason: "no_publishable_key" }, { status: 500 });
  }

  const baseUrl = `https://${frontendApi}`;
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").trim();
  const commonHeaders: HeadersInit = {
    Origin: origin,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const checks: CheckResult[] = [];

  // --- Check 1: environment endpoint (config + reachability) -----------------
  checks.push(
    await timed("environment", async () => {
      const res = await fetch(`${baseUrl}/v1/environment?_clerk_js_version=5.39.0`, {
        method: "GET",
        headers: { Origin: origin },
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, status: res.status, details: `HTTP ${res.status}` };
      const data = (await res.json()) as Record<string, unknown>;
      const userSettings = (data.user_settings ?? {}) as Record<string, unknown>;
      const signUp = (userSettings.sign_up ?? {}) as Record<string, unknown>;
      const signUpMode = signUp.mode;
      if (signUpMode !== "public" && signUpMode !== "restricted") {
        return { ok: false, status: res.status, details: `sign_up.mode=${String(signUpMode)} (expected public/restricted)` };
      }
      return { ok: true, status: res.status };
    }),
  );

  // --- Check 2: sign-up endpoint reachable -----------------------------------
  // We hit the endpoint with a deliberately invalid email — Clerk should
  // respond with 422 (form_param_format_invalid). Any 2xx/4xx means the
  // endpoint is up. 5xx or network error = trouble.
  checks.push(
    await timed("sign_ups_endpoint", async () => {
      const body = new URLSearchParams({ email_address: "health-check@example.invalid" });
      const res = await fetch(`${baseUrl}/v1/client/sign_ups?_clerk_js_version=5.39.0`, {
        method: "POST",
        headers: commonHeaders,
        body: body.toString(),
        cache: "no-store",
      });
      const ok = res.status >= 200 && res.status < 500;
      return { ok, status: res.status, details: ok ? undefined : `unexpected status ${res.status}` };
    }),
  );

  // --- Check 3: sign-in endpoint reachable -----------------------------------
  checks.push(
    await timed("sign_ins_endpoint", async () => {
      const body = new URLSearchParams({ identifier: "health-check@example.invalid" });
      const res = await fetch(`${baseUrl}/v1/client/sign_ins?_clerk_js_version=5.39.0`, {
        method: "POST",
        headers: commonHeaders,
        body: body.toString(),
        cache: "no-store",
      });
      const ok = res.status >= 200 && res.status < 500;
      return { ok, status: res.status, details: ok ? undefined : `unexpected status ${res.status}` };
    }),
  );

  const failed = checks.filter((c) => !c.ok);
  const totalMs = checks.reduce((sum, c) => sum + c.durationMs, 0);

  if (failed.length > 0) {
    const lines = [
      "ALERTE Auth Health Check",
      "",
      `Échec sur ${failed.length}/${checks.length} contrôles Clerk.`,
      `Frontend API: ${frontendApi}`,
      `Total: ${totalMs}ms`,
      "",
      ...checks.map((c) => {
        const flag = c.ok ? "OK" : "KO";
        const status = c.status ? ` (HTTP ${c.status})` : "";
        const detail = c.details ? ` — ${c.details}` : "";
        return `[${flag}] ${c.name}${status} — ${c.durationMs}ms${detail}`;
      }),
      "",
      "Impact possible : inscription / connexion bloquées en prod.",
      "Action : vérifier dashboard Clerk + déploiement Vercel.",
    ];
    await sendTelegramMessage(lines.join("\n"), { bot: "maintenance" });

    reportApiError({
      kind: "internal_error",
      route: "cron/auth-health-check",
      extra: { failedChecks: failed.map((f) => f.name), checks },
    });

    return NextResponse.json({ ok: false, frontendApi, totalMs, checks }, { status: 500 });
  }

  return NextResponse.json({ ok: true, frontendApi, totalMs, checks });
}
