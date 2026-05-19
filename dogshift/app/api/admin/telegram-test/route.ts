/**
 * Admin debug endpoint: send a sample message to a specific Telegram bot.
 *
 * Useful for two scenarios:
 *   1. Diagnose silent bot misconfiguration. The `relances` bot in
 *      particular fires sporadically from `/api/agents/relance-owner`
 *      and a missing TELEGRAM_BOT_TOKEN_RELANCES / TELEGRAM_CHAT_ID_RELANCES
 *      makes it disappear into the void. Hitting this endpoint forces
 *      a send and returns `{ telegramSent: boolean }` so you immediately
 *      know whether the env is wired.
 *   2. Preview the new unified message format on any bot without
 *      waiting for a real-world trigger (cron schedule, user action).
 *
 * Usage from /admin in a browser console (uses the admin session cookie):
 *
 *   fetch('/api/admin/telegram-test?bot=relances', { method: 'POST' })
 *     .then(r => r.json()).then(console.log)
 *
 * `bot` must be one of: candidatures | verifications | relances |
 * maintenance | news | reservations.
 */

import { NextResponse, type NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { sendTelegramMessage, type TelegramBot } from "@/lib/telegram/sendTelegramMessage";
import { tgHeader, tgSection, tgMessage, tgFooter, formatDateFR } from "@/lib/telegram/format";

export const runtime = "nodejs";

const ALLOWED_BOTS: ReadonlyArray<TelegramBot> = [
  "candidatures",
  "verifications",
  "relances",
  "maintenance",
  "news",
  "reservations",
];

function isAllowedBot(s: string): s is TelegramBot {
  return (ALLOWED_BOTS as readonly string[]).includes(s);
}

export async function POST(req: NextRequest) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const bot = (req.nextUrl.searchParams.get("bot") ?? "maintenance").trim();
  if (!isAllowedBot(bot)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BOT", allowed: ALLOWED_BOTS },
      { status: 400 },
    );
  }

  const message = tgMessage([
    tgHeader("🧪", `Test bot ${bot}`),
    [
      tgSection("ℹ️", "Pourquoi ce message"),
      `Sondage manuel déclenché depuis <code>/api/admin/telegram-test?bot=${bot}</code>.`,
      `Si tu reçois ça, le bot <code>${bot}</code> est correctement configuré côté Vercel.`,
    ],
    [
      tgSection("🎨", "Format"),
      `Header avec date FR, sections séparées par lignes vides, footer canonique.`,
      `Voir <code>lib/telegram/format.ts</code> + <code>brain/🤖 Agents/Telegram bots/Format Telegram.md</code>.`,
    ],
    tgFooter(),
  ]);

  const sent = await sendTelegramMessage(message, { bot, parseMode: "HTML" });

  return NextResponse.json({
    ok: true,
    bot,
    telegramSent: sent,
    date: formatDateFR(),
    hint: sent
      ? "Message envoyé. Si tu ne le vois pas dans Telegram, vérifie le chat ID."
      : `Le bot ${bot} a refusé l'envoi. Vérifie TELEGRAM_BOT_TOKEN_${bot.toUpperCase()} et TELEGRAM_CHAT_ID_${bot.toUpperCase()} dans les env vars Vercel.`,
  });
}
