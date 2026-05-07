/**
 * Minimal best-effort Telegram Bot API helper.
 *
 * Supports multiple bots via the `bot` option. Each bot maps to its own pair
 * of env vars (e.g. TELEGRAM_BOT_TOKEN_CANDIDATURES / TELEGRAM_CHAT_ID_CANDIDATURES).
 * Falls back to the generic TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID when the
 * specific vars are not set (backwards-compatible).
 *
 * Always swallows errors — callers treat Telegram notifications as fire-and-
 * forget side effects that must never block or crash the main request.
 */

const TELEGRAM_API_TIMEOUT_MS = 4000;

/**
 * Available bot channels.
 * Each one corresponds to a dedicated Telegram bot with its own token + chat.
 */
export type TelegramBot =
  | "candidatures"   // @dogshift_admin_bot — candidatures, contrats, entretiens, sitters
  | "verifications"  // @dogshift_verifications_bot — vérifications identité & pension
  | "relances"       // @dogshift_relances_bot — relances owners, leads, onboarding, inactivité
  | "maintenance"    // @dogshift_maintenance_bot — deps nightly & weekly report
  | "news"           // @dogshift_news_bot — veille canine quotidienne
  | "reservations";  // @dogshift_reservation_bot — réservations & paiements (réservé)

const BOT_SUFFIX: Record<TelegramBot, string> = {
  candidatures:  "CANDIDATURES",
  verifications: "VERIFICATIONS",
  relances:      "RELANCES",
  maintenance:   "MAINTENANCE",
  news:          "NEWS",
  reservations:  "RESERVATIONS",
};

type SendTelegramMessageOpts = {
  /** Target bot channel. Defaults to the generic TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID. */
  bot?: TelegramBot;
  /** Override the chat ID. */
  chatId?: string;
  /** Send as Markdown (default: plain text). */
  parseMode?: "Markdown" | "HTML";
};

/**
 * Sends a message to the specified Telegram bot channel.
 * Returns `true` on apparent success, `false` on any failure.
 */
export async function sendTelegramMessage(
  text: string,
  opts: SendTelegramMessageOpts = {},
): Promise<boolean> {
  const suffix = opts.bot ? BOT_SUFFIX[opts.bot] : null;

  const token = (
    (suffix ? process.env[`TELEGRAM_BOT_TOKEN_${suffix}`] : undefined) ??
    process.env.TELEGRAM_BOT_TOKEN ??
    ""
  ).trim();

  const chatId = (
    opts.chatId ??
    (suffix ? process.env[`TELEGRAM_CHAT_ID_${suffix}`] : undefined) ??
    process.env.TELEGRAM_CHAT_ID ??
    ""
  ).trim();

  if (!token || !chatId) {
    console.info(`[telegram] bot="${opts.bot ?? "default"}" not configured — skipping`);
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  try {
    const body: Record<string, string> = { chat_id: chatId, text };
    if (opts.parseMode) body.parse_mode = opts.parseMode;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[telegram] sendMessage non-2xx", { bot: opts.bot, status: res.status, body: errBody });
      return false;
    }

    return true;
  } catch (err) {
    console.error("[telegram] sendMessage failed", {
      bot: opts.bot,
      message: err instanceof Error ? err.message : String(err),
      aborted: controller.signal.aborted,
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
