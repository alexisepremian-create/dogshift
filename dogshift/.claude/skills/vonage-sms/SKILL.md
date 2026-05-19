---
name: vonage-sms
description: Send transactional SMS in DogShift via Vonage — Unicode normalization, alphanumeric sender, anti-spam discipline. Use when adding an SMS trigger, debugging delivery, or modifying lib/sms/.
---

# Vonage SMS — DogShift

## Stack

- **Library** : `@vonage/server-sdk` + `@vonage/sms`
- **Helper** : `lib/sms/sendSms.ts` — `sendSms(text, { to })`
- **Sender** : alphanumeric label "DogShift" (or long-code phone if dest network rejects alphanumeric)
- **Discipline** : fire-and-forget (`.catch(() => {})`) — NEVER block user-facing routes

## When to send SMS

Reserved for **time-critical transactional** moments only :
- Booking confirmation (just paid → sitter has the slot)
- Last-minute booking accepted / cancelled
- Sitter activation code (email + SMS for the DS-XXXX-XXXX code)

NOT for : marketing, reminders that can be email, anything > 1/day per user.

Volume target : < 10 SMS / day across all DogShift. Otherwise the cost spikes and users disable.

## Calling the helper

```ts
import { sendSms } from "@/lib/sms/sendSms";

void sendSms(
  `DogShift : ta réservation pour vendredi 14h est confirmée. Détails sur ${url}`,
  { to: "+41791234567" }
).catch(() => {});
```

Returns `{ ok: true } | { ok: false, skipped?: true, error: string }`. The helper :
1. Normalizes the phone number (E.164, strips spaces/dashes/parens, "00" → "+")
2. Validates it looks like a phone (`+?[0-9]{6,20}`)
3. Resolves the sender from `VONAGE_SMS_FROM` (or "DogShift" default)
4. Auto-detects Unicode → `type: UNICODE` (costs more but rendering correct)

**Don't pre-normalize or truncate yourself** — the helper handles it. Bypassing = silently mangled accents + billing inconsistencies.

## Unicode handling

The helper auto-normalizes :
- NFC Unicode (combining-accent → precomposed)
- Curly quotes / en-dashes / ellipsis → ASCII equivalents
- If any codepoint > 0x7F survives → `type: UNICODE` is set automatically

Why this matters : non-Unicode SMS at GSM-7 = 160 chars per segment, Unicode = 70 chars per segment. Mid-message accent breaks billing accuracy. Always let the helper decide.

## Sender configuration

`VONAGE_SMS_FROM` env :
- Alphanumeric label : `DogShift` (≤ 11 chars, letters + digits) — default
- Long-code phone : `+41791234567` (E.164) — fallback for networks that reject alphanumeric (most US carriers do)

**Switzerland accepts alphanumeric.** France too. Other markets need testing.

## Length budget

| Type | Per segment | Notes |
|---|---|---|
| GSM-7 (ASCII) | 160 chars | Multi-segment seamless |
| UCS-2 (Unicode) | 70 chars | Multi-segment seamless |

Keep messages < 160 chars when possible. The user gets one SMS, billing is 1 segment.

For URLs : use a short link (e.g. `dgshft.ch/b/abc123`) instead of full Vercel URLs — preserves segment budget. **Not yet implemented** — candidate for a `lib/url/shortener.ts` someday.

## Anti-patterns

- ❌ Block a route on SMS delivery (fire-and-forget always)
- ❌ Pre-escape / truncate yourself — helper handles it
- ❌ Send marketing SMS — pilote → transactional only
- ❌ Send to unverified phone numbers
- ❌ Include sensitive info (passwords, full card numbers, secrets)
- ❌ Send in batches of > 50 — rate-limited at Vonage edge
- ❌ Use generic `VONAGE_API_KEY` for both prod + dev — separate accounts

## When SMS doesn't arrive

1. **Phone format wrong** : E.164 mandatory (`+41...`). Check the helper's `normalizePhone()` output via log
2. **Vonage account suspended** : low credit balance, fraud detection
3. **Network rejects alphanumeric sender** : try long-code fallback
4. **Carrier blocked sending IP** : Vonage shifts IPs, usually transient
5. **User opt-out** : check Vonage dashboard for STOP messages

Vonage dashboard has the per-message delivery report (sent / delivered / failed / rejected).

## Persistence

SMS sends are NOT persisted in DB by default — they're fire-and-forget. For high-value flows (activation code, payment confirmation), wrap the call to record :

```ts
const result = await sendSms(text, { to });
await prisma.smsLog.create({  // or AgentLog
  data: { userId, type: "activation_code", phone: to, sentAt: new Date(), ok: result.ok },
});
```

Currently NO `SmsLog` model exists. If you need persistence, add it (additive migration via `prisma-schema` skill).

## Env vars

```bash
VONAGE_API_KEY=
VONAGE_API_SECRET=
VONAGE_SMS_FROM=DogShift           # or +41791234567
```

## Where to look

- `lib/sms/sendSms.ts` — single source of truth
- `app/api/host/activation-code/route.ts` — example call site
- Vonage dashboard — delivery reports + credit balance + API logs
