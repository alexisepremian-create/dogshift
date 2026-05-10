/**
 * POST /api/telegram/webhook/[bot]
 *
 * Receives Telegram Bot API updates for the specified bot channel.
 * Each bot maps to its own dedicated Telegram bot (candidatures, verifications,
 * relances, maintenance, news, reservations).
 *
 * Security: Telegram attaches X-Telegram-Bot-Api-Secret-Token to each call.
 * We verify it against TELEGRAM_WEBHOOK_SECRET (set via Vercel env).
 *
 * Always responds 200 immediately — processing runs in the background so
 * Telegram never retries due to timeouts.
 */

import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import type { TelegramBot } from "@/lib/telegram/sendTelegramMessage";
import { handleBotUpdate, type TelegramUpdate } from "@/lib/telegram/webhookHandlers";

const VALID_BOTS: TelegramBot[] = [
  "candidatures",
  "verifications",
  "relances",
  "maintenance",
  "news",
  "reservations",
];

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ bot: string }> }
) {
  const { bot: botParam } = await context.params;
  const bot = botParam as TelegramBot;

  if (!VALID_BOTS.includes(bot)) {
    return NextResponse.json({ ok: false, error: "Unknown bot" }, { status: 400 });
  }

  // Verify Telegram webhook secret
  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expectedSecret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  if (expectedSecret && incomingSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Respond 200 immediately, then process via next/server after()
  // which keeps the runtime alive until the callback resolves.
  after(async () => {
    try {
      await handleBotUpdate(bot, update);
    } catch (err) {
      console.error(`[telegram/webhook/${bot}] handler error`, err);
    }
  });

  return NextResponse.json({ ok: true });
}
