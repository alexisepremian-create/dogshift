/**
 * Daily Auth.js v5 authentication health check.
 *
 * Why this exists
 *   Auth gates every paid feature. We cannot afford to discover from a user
 *   complaint days later that login or signup silently broke (e.g. an
 *   AUTH_SECRET rotation, a Prisma connection issue, a Google OAuth client
 *   misconfiguration). The cron runs once a day at 07:00 UTC, hits every
 *   critical auth surface, and pings the Maintenance Telegram bot when
 *   something is off.
 *
 * What it checks (no real accounts created)
 *   1. `/api/auth/session` returns 200 with a JSON body (null body when
 *      unauthenticated is the normal happy path).
 *   2. `/api/auth/csrf` returns 200 with a non-empty csrfToken — required
 *      for any subsequent POST to /api/auth/signin/credentials.
 *   3. `/api/auth/providers` returns 200 with both `credentials` and
 *      `google` listed.
 *   4. `/api/auth/signin/credentials` accepts requests (any 2xx/3xx is
 *      healthy — we don't try to actually authenticate, just confirm the
 *      endpoint isn't 500'ing).
 *
 * On failure, sends a Telegram alert to the Maintenance bot. On success,
 * we stay silent (no daily noise).
 *
 * Replaces the previous Clerk-based version that hit Clerk's Frontend API
 * — removed alongside the Auth.js migration (PRs #316 / #317 / #319).
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

async function timed(
  name: string,
  fn: () => Promise<{ ok: boolean; status?: number; details?: string }>,
): Promise<CheckResult> {
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

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.dogshift.ch").trim();

  // Self-call our own deployment. Same-origin so cookies/CSRF semantics
  // mirror what a real browser sees.
  async function selfFetch(path: string, init?: RequestInit) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { Origin: baseUrl, ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  }

  const checks: CheckResult[] = [];

  // 1) Session endpoint — returns the current session JSON (null if anon).
  checks.push(
    await timed("session", async () => {
      const res = await selfFetch("/api/auth/session");
      if (!res.ok) return { ok: false, status: res.status, details: `HTTP ${res.status}` };
      // Body should be valid JSON (either {} or { user: ... }).
      try {
        await res.json();
      } catch (err) {
        return {
          ok: false,
          status: res.status,
          details: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
      return { ok: true, status: res.status };
    }),
  );

  // 2) CSRF token — needed for credentials sign-in flow.
  checks.push(
    await timed("csrf_token", async () => {
      const res = await selfFetch("/api/auth/csrf");
      if (!res.ok) return { ok: false, status: res.status, details: `HTTP ${res.status}` };
      const body = (await res.json().catch(() => null)) as { csrfToken?: string } | null;
      const token = typeof body?.csrfToken === "string" ? body.csrfToken : "";
      if (!token) return { ok: false, status: res.status, details: "csrfToken missing or empty" };
      return { ok: true, status: res.status };
    }),
  );

  // 3) Providers list — must contain credentials + google.
  checks.push(
    await timed("providers", async () => {
      const res = await selfFetch("/api/auth/providers");
      if (!res.ok) return { ok: false, status: res.status, details: `HTTP ${res.status}` };
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return { ok: false, status: res.status, details: "invalid providers JSON" };
      const hasCredentials = "credentials" in body;
      const hasGoogle = "google" in body;
      if (!hasCredentials || !hasGoogle) {
        return {
          ok: false,
          status: res.status,
          details: `missing providers (credentials=${hasCredentials}, google=${hasGoogle})`,
        };
      }
      return { ok: true, status: res.status };
    }),
  );

  // 4) Credentials sign-in endpoint reachability — POST a deliberately
  //    invalid payload. Auth.js v5 responds with 200 + JSON for credentials
  //    or 302 redirect; both are healthy. 5xx / network = trouble.
  checks.push(
    await timed("credentials_endpoint", async () => {
      const res = await selfFetch("/api/auth/signin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: "health-check@example.invalid",
          password: "x",
        }).toString(),
        redirect: "manual",
      });
      const ok = res.status >= 200 && res.status < 500;
      return { ok, status: res.status, details: ok ? undefined : `unexpected status ${res.status}` };
    }),
  );

  const failed = checks.filter((c) => !c.ok);
  const totalMs = checks.reduce((sum, c) => sum + c.durationMs, 0);

  if (failed.length > 0) {
    const lines = [
      "ALERTE Auth Health Check (Auth.js v5)",
      "",
      `Échec sur ${failed.length}/${checks.length} contrôles.`,
      `Base URL: ${baseUrl}`,
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
      "Action : vérifier les vars d'env (AUTH_SECRET, AUTH_GOOGLE_*) + redéploiement Vercel.",
    ];
    await sendTelegramMessage(lines.join("\n"), { bot: "maintenance" });

    reportApiError({
      kind: "internal_error",
      route: "cron/auth-health-check",
      extra: { failedChecks: failed.map((f) => f.name), checks },
    });

    return NextResponse.json({ ok: false, baseUrl, totalMs, checks }, { status: 500 });
  }

  return NextResponse.json({ ok: true, baseUrl, totalMs, checks });
}
