---
name: telegram-format
description: Write or modify a Telegram message in DogShift to match the canonical format used by the maintenance-recap bot. Use whenever adding a sendTelegramMessage call, refactoring a bot's payload, or when the user mentions formatting consistency on bots.
---

# Telegram format — canonical DogShift style

## Source of truth

The **maintenance-recap** daily cron (`/api/cron/maintenance-recap`) defines the visual style. Every Telegram message in DogShift must mirror it.

## Rules (non-negotiable)

1. **`parseMode: "HTML"`** — never Markdown (breaks on emails with `_`)
2. **Header** : `<emoji> <b>Titre — 19 mai 2026</b>` (FR abbreviated date)
3. **Blank line between sections**
4. **Section header** : `<emoji> <b>Section</b>` then body below
5. **Footer** : `<i>Généré automatiquement · 19 mai 2026</i>`
6. **Color emojis unified** : 🔴 high · 🟡 medium · 🟢 low · ✅ ok · ⚠️ warning · 🚨 error
7. **Sort by urgency** (high → medium → low → alphabetical within tier) — never bucket by color group

## Shared helpers (use them — don't reinvent)

`lib/telegram/format.ts` exports :

```ts
formatDateFR(date: Date, style?: "abbr" | "long")  // "19 mai 2026" or "19 mai 2026"
tgHeader(emoji: string, title: string, date?: Date) // "<emoji> <b>title — date</b>"
tgSection(emoji: string, title: string)             // "<emoji> <b>title</b>"
tgFooter(date?: Date)                                // "<i>Généré automatiquement · date</i>"
pluralFR(n: number, singular: string, plural?: string)
riskEmoji(level: "high" | "medium" | "low")          // 🔴 / 🟡 / 🟢
riskRank(level)                                      // for sort comparators
escapeHtml(text: string)                             // ALWAYS escape user input
```

## Canonical template

```ts
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { tgHeader, tgSection, tgFooter, escapeHtml } from "@/lib/telegram/format";

const now = new Date();
const message = [
  tgHeader("🔧", "DogShift Maintenance", now),
  "",
  tgSection("⚙️", "Agents (24h)"),
  "✅ 15 runs, 0 erreur",
  "",
  tgSection("📅", "Réservations (24h)"),
  "1 nouvelle · 0 confirmées/payées",
  "",
  tgFooter(now),
].join("\n");

const sent = await sendTelegramMessage(message, {
  bot: "maintenance",
  parseMode: "HTML",
});
```

## The 6 bots — pick the right one

| Bot | Use for | Pattern |
|---|---|---|
| `candidatures` | Funnel sitter (apply → score → contrat → activation) | Per-event |
| `verifications` | Vérification identité / OPAn / pension | Per-event |
| `relances` | Funnel owner + récaps groupés sitter-side | Mix per-event / per-run |
| `maintenance` | Recap quotidien, deps, bugs, auth health | Per-run (daily) |
| `news` | Veille canine quotidienne | Per-run (daily) |
| `reservations` | Bookings / paiements / payouts | **Pas encore actif** — réservé |

Each bot has its own `TELEGRAM_BOT_TOKEN_<SUFFIX>` + `TELEGRAM_CHAT_ID_<SUFFIX>` env var.

## Critical patterns

### Cron route — always await + persist

```ts
const sent = await sendTelegramMessage(message, { bot: "...", parseMode: "HTML" });

// Persist for audit
await prisma.agentLog.create({
  data: {
    agentName: "...",
    actionType: "...",
    summary: "...",
    details: { telegramSent: sent },  // ← boolean
  },
});
```

**Why** : `sendTelegramMessage` returns `false` on missing env vars (silent fail). Without persistence, you'd never know a bot is misconfigured. May 19 2026 incident.

### User-facing route — fire-and-forget OK

```ts
void sendTelegramMessage(message, { bot: "..." }).catch(() => {});
```

Never block a user request on Telegram delivery.

### HTML escaping — always for user input

```ts
const message = tgHeader("👤", "Nouveau owner") + "\n" + escapeHtml(owner.email);
```

If owner.email is `<bobby@x.com>` (XSS attempt) unescaped → Telegram breaks the message.

## Récap groupé vs per-event

**Per-event** (1 msg par occurrence) : signup, candidature, verif submit, etc.

**Per-run** (1 msg total à la fin du cron, groupé) : ALL sitter-side crons that loop over 10+ sitters. Send 1 msg per sitter = spam.

Pattern récap groupé :
```ts
const lines: string[] = [];
for (const sitter of sitters) {
  // … do work, accumulate detail
  lines.push(`👋 ${sitter.name} — ${stage}`);
}
if (lines.length > 0) {
  const msg = [
    tgHeader("👋", "Nudges sitter onboarding", new Date()),
    "",
    tgSection("📋", "Détail"),
    ...lines,
    "",
    tgFooter(new Date()),
  ].join("\n");
  await sendTelegramMessage(msg, { bot: "relances", parseMode: "HTML" });
}
```

Silence if nothing to report.

## What NOT to do

- ❌ `parseMode: "Markdown"` (breaks on `_` in emails)
- ❌ Date format `"2026-05-19"` (always FR abbreviated via `formatDateFR()`)
- ❌ Send 10 messages per cron run when 1 grouped recap suffices
- ❌ Fire-and-forget in a cron route (Vercel kills it)
- ❌ Forget `escapeHtml()` on user input
- ❌ Roll your own header / footer — always use the helpers

## Debug "bot a rien envoyé"

1. Diagnostic endpoint : `POST /api/admin/telegram-test?bot=<name>` (from /admin in browser console — uses session cookie)
2. Check AgentLog : `details->>'telegramSent' as telegram` — if all `false`, an env var is missing
3. Check Vercel env vars : both `TELEGRAM_BOT_TOKEN_<SUFFIX>` AND `TELEGRAM_CHAT_ID_<SUFFIX>` must be set

## Where to look

- `lib/telegram/sendTelegramMessage.ts` — sender + env var resolution
- `lib/telegram/format.ts` — shared helpers
- `app/api/cron/maintenance-recap/route.ts` — visual reference template
- `brain/🤖 Agents/Telegram bots/` — Obsidian fiches per bot with template examples
- `docs/telegram.md` — official setup + troubleshooting
