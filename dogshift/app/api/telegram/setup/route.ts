/**
 * GET /api/telegram/setup
 *
 * One-time admin endpoint that registers webhooks for all 6 Telegram bots.
 * Call once after deploying or when the webhook URL changes.
 *
 * Protected by the MAINTENANCE_API_KEY header.
 *
 * curl -H "Authorization: Bearer <MAINTENANCE_API_KEY>" \
 *      https://www.dogshift.ch/api/telegram/setup
 */

import { NextRequest, NextResponse } from "next/server";

const BOTS: { name: string; tokenEnv: string }[] = [
  { name: "candidatures",  tokenEnv: "TELEGRAM_BOT_TOKEN_CANDIDATURES" },
  { name: "verifications", tokenEnv: "TELEGRAM_BOT_TOKEN_VERIFICATIONS" },
  { name: "relances",      tokenEnv: "TELEGRAM_BOT_TOKEN_RELANCES" },
  { name: "maintenance",   tokenEnv: "TELEGRAM_BOT_TOKEN_MAINTENANCE" },
  { name: "news",          tokenEnv: "TELEGRAM_BOT_TOKEN_NEWS" },
  { name: "reservations",  tokenEnv: "TELEGRAM_BOT_TOKEN_RESERVATIONS" },
];

export async function GET(req: NextRequest) {
  // Auth
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = (process.env.MAINTENANCE_API_KEY ?? "").trim();
  if (!apiKey || auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();

  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL not set" }, { status: 500 });
  }

  const results = await Promise.all(
    BOTS.map(async ({ name, tokenEnv }) => {
      const token = (process.env[tokenEnv] ?? "").trim();
      if (!token) return { bot: name, status: "skipped", reason: `${tokenEnv} not set` };

      const webhookUrl = `${appUrl}/api/telegram/webhook/${name}`;

      try {
        const body: Record<string, unknown> = {
          url: webhookUrl,
          allowed_updates: ["message"],
          drop_pending_updates: true,
        };
        if (secret) body.secret_token = secret;

        const res = await fetch(
          `https://api.telegram.org/bot${token}/setWebhook`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );

        const data = await res.json() as { ok: boolean; description?: string };
        return {
          bot: name,
          status: data.ok ? "registered" : "error",
          url: webhookUrl,
          detail: data.description ?? null,
        };
      } catch (err) {
        return {
          bot: name,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  const allOk = results.every((r) => r.status === "registered" || r.status === "skipped");
  return NextResponse.json({ ok: allOk, results }, { status: allOk ? 200 : 207 });
}
