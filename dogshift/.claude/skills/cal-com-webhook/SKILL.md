---
name: cal-com-webhook
description: Work with Cal.com webhooks in DogShift — HMAC-SHA256 signature verification, the 3 subscribed triggers (BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED), candidatures Telegram bot notification. Use when editing /api/agents/calendrier, debugging a Cal.com sync issue, or onboarding a new Cal.com trigger.
---

# Cal.com webhooks — DogShift

## What Cal.com is used for

The sitter onboarding funnel uses Cal.com for the **interview booking step** (`HIGH` scored candidatures get an email with a Cal.com link → they pick a slot → the founder gets pinged).

Cal.com URL : `https://cal.com/dogshift/entretien-dogshift` (default, overridable via `NEXT_PUBLIC_CALCOM_INTERVIEW_URL`).

## Webhook endpoint

`POST https://www.dogshift.ch/api/agents/calendrier`

Three triggers subscribed in Cal.com → Settings → Developer → Webhooks :
- `BOOKING_CREATED` → sitter booked an interview
- `BOOKING_CANCELLED` → sitter cancelled
- `BOOKING_RESCHEDULED` → sitter moved their slot

Each posts to the `candidatures` Telegram bot with the relevant emoji (🎉 / ❌ / 🔄).

## HMAC signature verification

Cal.com signs the **raw request body** with the webhook secret + sends the hex digest in `X-Cal-Signature-256`. We verify in constant time.

```ts
import { verifyCalcomSignature } from "@/lib/calcom/verifyCalcomSignature";

const rawBody = await req.text(); // BEFORE parsing JSON
const signature = req.headers.get("x-cal-signature-256") ?? "";
const result = verifyCalcomSignature({
  rawBody,
  signature,
  secret: process.env.CALCOM_WEBHOOK_SECRET ?? "",
});
if (!result.ok) {
  return NextResponse.json({ error: result.reason }, { status: 401 });
}
```

**Critical** : `await req.text()` **before** `JSON.parse`. Re-stringifying changes whitespace and breaks the HMAC.

## Tell-tale signature failures

`verifyCalcomSignature` returns a typed reason :

| Reason | Diagnosis |
|---|---|
| `MISSING_SECRET` | `CALCOM_WEBHOOK_SECRET` env not set on Vercel |
| `MISSING_SIGNATURE` | Cal.com sent no `X-Cal-Signature-256` header (or no-secret-provided) → the secret is missing on Cal.com side too |
| `BAD_SIGNATURE` | Both sides have a secret but they don't match → re-paste from Cal.com dashboard to Vercel |

When Cal.com sends literal `no-secret-provided` as the signature, the bug is on **Cal.com side**. Don't dig into Vercel env first.

## Payload shape

Cal.com payloads vary by trigger. Defensive parsing recommended :

```ts
const body = JSON.parse(rawBody) as {
  triggerEvent: "BOOKING_CREATED" | "BOOKING_CANCELLED" | "BOOKING_RESCHEDULED";
  payload: {
    type?: string;
    title?: string;
    attendees?: Array<{ email?: string; name?: string }>;
    startTime?: string;
    rescheduleStartTime?: string;
    // … many other fields
  };
};
```

Trust nothing — always coalesce to defaults.

## Telegram notification

Per `telegram-format` skill rules. Currently using Markdown legacy on this route — when refactoring, migrate to HTML + `tgHeader` helpers :

```ts
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

await sendTelegramMessage(
  `🎉 *Nouvel entretien booké !*\n👤 ${name}\n📧 ${email}\n📅 ${startTime}\n🔗 ${calComLink}`,
  { bot: "candidatures", parseMode: "Markdown" },
);
```

Bot suffix `CANDIDATURES` (env vars `TELEGRAM_BOT_TOKEN_CANDIDATURES` + `TELEGRAM_CHAT_ID_CANDIDATURES`).

## AgentLog

Persist every webhook call :

```ts
await prisma.agentLog.create({
  data: {
    agentName: "calendrier",
    actionType: body.triggerEvent,  // BOOKING_CREATED etc.
    summary: `…`,
    details: { ...body.payload, telegramSent },
    status: "ok",
  },
});
```

Filter `/admin/agents` views by `agentName=calendrier`.

## Adding a new Cal.com trigger

1. Subscribe in Cal.com dashboard → Webhooks → Add the trigger (e.g. `MEETING_ENDED`)
2. Handle in `/api/agents/calendrier/route.ts` (new case)
3. Update the brain fiche `brain/🤖 Agents/Calendrier.md`
4. Update `brain/🤖 Agents/Telegram bots/Bot candidatures.md` (new template)
5. Smoke test : create a test event in Cal.com, verify the Telegram lands

## What NOT to do

- ❌ Parse JSON before verifying HMAC — re-stringifying breaks the signature
- ❌ Trust webhook payloads to enrich your DB without verifying signature (CSRF / replay attack)
- ❌ Send Telegram with sensitive PII unsanitized (use `escapeHtml()`)
- ❌ Subscribe a new trigger without an idempotency check (Cal.com retries on 5xx)
- ❌ Auto-create a sitter account from a Cal.com payload (the candidature → admin → contract flow is the only path)

## Env vars

```bash
CALCOM_WEBHOOK_SECRET=             # must match Cal.com dashboard EXACTLY
NEXT_PUBLIC_CALCOM_INTERVIEW_URL=  # defaults to https://cal.com/dogshift/entretien-dogshift
TELEGRAM_BOT_TOKEN_CANDIDATURES=
TELEGRAM_CHAT_ID_CANDIDATURES=
```

## Where to look

- `lib/calcom/verifyCalcomSignature.ts` — HMAC helper
- `app/api/agents/calendrier/route.ts` — the handler
- `brain/🤖 Agents/Calendrier.md` — agent fiche
- `docs/telegram.md` — Telegram setup
