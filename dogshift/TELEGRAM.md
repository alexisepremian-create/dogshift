# Telegram Bots — Setup & Troubleshooting

DogShift uses **6 dedicated Telegram bots** for internal admin notifications and interactive commands.

## Bots

| Bot | Username | Purpose | Token env var |
|-----|----------|---------|---------------|
| candidatures | @dogshift_admin_bot | Candidatures, contrats, entretiens, sitters | `TELEGRAM_BOT_TOKEN_CANDIDATURES` |
| verifications | @dogshift_verifications_bot | Vérifications identité & pension | `TELEGRAM_BOT_TOKEN_VERIFICATIONS` |
| relances | @dogshift_relances_bot | Relances owners, leads, onboarding | `TELEGRAM_BOT_TOKEN_RELANCES` |
| maintenance | @dogshift_maintenance_bot | Deps nightly & weekly report | `TELEGRAM_BOT_TOKEN_MAINTENANCE` |
| news | @dogshift_news_bot | Veille canine quotidienne | `TELEGRAM_BOT_TOKEN_NEWS` |
| reservations | @dogshift_reservation_bot | Réservations & paiements | `TELEGRAM_BOT_TOKEN_RESERVATIONS` |

## Architecture

```
Telegram Cloud
  │
  │ POST /api/telegram/webhook/{bot}
  ▼
app/api/telegram/webhook/[bot]/route.ts   ← verifies secret, responds 200, uses after()
  │
  ▼
lib/telegram/webhookHandlers.ts           ← dispatches commands, queries Prisma, calls send
  │
  ▼
lib/telegram/sendTelegramMessage.ts       ← POST to api.telegram.org/bot<token>/sendMessage
```

**Outbound notifications** (candidature received, verification submitted, booking created, etc.)
call `sendTelegramMessage()` directly from their respective API routes and agents.

## Environment Variables (Vercel)

All must be set in **Vercel → Settings → Environment Variables** (production + preview).

### Required per bot
```
TELEGRAM_BOT_TOKEN_CANDIDATURES=<token from @BotFather>
TELEGRAM_BOT_TOKEN_VERIFICATIONS=<token>
TELEGRAM_BOT_TOKEN_RELANCES=<token>
TELEGRAM_BOT_TOKEN_MAINTENANCE=<token>
TELEGRAM_BOT_TOKEN_NEWS=<token>
TELEGRAM_BOT_TOKEN_RESERVATIONS=<token>
```

### Chat IDs
Per-bot chat IDs are optional; the system falls back to the generic one:
```
TELEGRAM_CHAT_ID=<your chat or group ID>
# Optional per-bot overrides:
TELEGRAM_CHAT_ID_CANDIDATURES=<id>
TELEGRAM_CHAT_ID_VERIFICATIONS=<id>
...
```

### Shared
```
TELEGRAM_WEBHOOK_SECRET=<random string>   # Telegram sends this in X-Telegram-Bot-Api-Secret-Token
MAINTENANCE_API_KEY=<random string>        # Protects GET /api/telegram/setup
NEXT_PUBLIC_APP_URL=https://www.dogshift.ch  # Must match production domain exactly (with www)
```

## Webhook Registration

Webhooks must be registered **once** after first deploy or whenever the domain changes.

```bash
curl -H "Authorization: Bearer <MAINTENANCE_API_KEY>" \
     https://www.dogshift.ch/api/telegram/setup
```

This calls Telegram's `setWebhook` for each bot, pointing to
`https://www.dogshift.ch/api/telegram/webhook/{bot}`.

The response shows status per bot:
```json
{
  "ok": true,
  "results": [
    { "bot": "candidatures", "status": "registered", "url": "..." },
    { "bot": "verifications", "status": "skipped", "reason": "TELEGRAM_BOT_TOKEN_VERIFICATIONS not set" }
  ]
}
```

## How Commands Work

1. User sends `/start` or `/commandes` to a bot in Telegram
2. Telegram POSTs the update to `/api/telegram/webhook/{bot}`
3. Route verifies `X-Telegram-Bot-Api-Secret-Token`, responds 200 immediately
4. `after()` callback runs `handleBotUpdate()` which:
   - Checks the chat ID matches the authorised one (security)
   - Parses the command
   - Queries Prisma for data
   - Sends the reply via `sendTelegramMessage()`

## Common Issues & Fixes

### Bots don't respond to commands
**Cause (fixed 2026-05-10):** The webhook route used a fire-and-forget pattern
(`handleBotUpdate().catch(...)` without `await`). On Vercel serverless, the
runtime terminates after sending the 200 response, aborting all in-flight
`fetch` calls — including the reply to Telegram.

**Fix:** Replaced with `after()` from `next/server`, which keeps the Vercel
runtime alive until the async callback resolves.

### `sendMessage failed` with `aborted: true` in logs
Same root cause as above. The `AbortController` in `sendTelegramMessage` reports
`aborted` because the Vercel runtime killed the function, not because of a real
timeout. The timeout was also increased from 4s to 8s as a safety margin.

### Bot says nothing but webhook returns 200
- Check that `TELEGRAM_CHAT_ID` (or the per-bot variant) matches your actual
  chat/group ID. Get it by sending a message to the bot and checking
  `https://api.telegram.org/bot<TOKEN>/getUpdates`.
- If the chat ID doesn't match, the handler silently returns (security).

### `skipped` status when calling /api/telegram/setup
The specific `TELEGRAM_BOT_TOKEN_<SUFFIX>` env var is not set on Vercel.
The setup endpoint skips bots without tokens.

### Webhook returns 401
`TELEGRAM_WEBHOOK_SECRET` on Vercel doesn't match the one registered with
Telegram. Re-run `/api/telegram/setup` to re-register with the current secret.

## Getting a Chat ID

1. Open the bot in Telegram and send `/start`
2. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Look for `"chat": { "id": 123456789 }` in the response
4. Set that as `TELEGRAM_CHAT_ID` (or the per-bot variant)

## File Map

| File | Role |
|------|------|
| `app/api/telegram/setup/route.ts` | One-time webhook registration endpoint |
| `app/api/telegram/webhook/[bot]/route.ts` | Receives Telegram updates, dispatches to handler |
| `lib/telegram/webhookHandlers.ts` | Command parsing & Prisma queries per bot |
| `lib/telegram/sendTelegramMessage.ts` | Low-level send helper (used by handlers + all outbound notifications) |
