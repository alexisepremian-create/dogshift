/**
 * Minimal best-effort Telegram Bot API helper.
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from env.
 * Silently no-ops (with a console.info) when either is missing so the app
 * works in dev without Telegram configured.
 *
 * Always swallows errors — callers treat Telegram notifications as fire-and-
 * forget side effects that must never block or crash the main request.
 */

const TELEGRAM_API_TIMEOUT_MS = 4000;

type SendTelegramMessageOpts = {
  /** Override the default chat from TELEGRAM_CHAT_ID. */
  chatId?: string;
};

/**
 * Sends a plain-text message to the configured Telegram chat.
 * Returns `true` on apparent success, `false` on any failure.
 */
export async function sendTelegramMessage(
  text: string,
  opts: SendTelegramMessageOpts = {},
): Promise<boolean> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (opts.chatId || process.env.TELEGRAM_CHAT_ID || "").trim();

  if (!token || !chatId) {
    console.info("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured — skipping");
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[telegram] sendMessage non-2xx", { status: res.status, body });
      return false;
    }

    return true;
  } catch (err) {
    console.error("[telegram] sendMessage failed", {
      message: err instanceof Error ? err.message : String(err),
      aborted: controller.signal.aborted,
    });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
