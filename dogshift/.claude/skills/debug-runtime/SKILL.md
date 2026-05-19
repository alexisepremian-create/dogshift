---
name: debug-runtime
description: Diagnose a prod runtime error in DogShift — fetch Vercel runtime logs, decode truncated messages, cross-check Sentry, identify the responsible route + commit. Use whenever the user reports a 5xx, a silent failure, or any "ça marche pas en prod" symptom.
---

# Debug runtime — DogShift

When the user reports a production bug ("ça marche pas", "j'ai une 500", "le cron n'a rien envoyé"), follow this playbook before guessing.

## 1 — Identify the surface

Ask **only if not obvious** from the user's message:
- Which URL / route / cron is failing?
- HTTP status (500, 401, 403, silent)?
- When did it start (within minutes / hours / days)?

Otherwise infer from screenshots and DevTools output the user shared.

## 2 — Pull the runtime logs

Use the Vercel MCP `mcp__c0c41020-*__get_runtime_logs` tool. Key parameters:

```js
{
  projectId: "dogshift",
  teamId: "team_EjMwczRIOSC2noQ0hFXd4y7a",
  environment: "production",
  query: "<distinctive substring>",
  since: "30m"  // or 2h, 24h
}
```

**Important**: the MCP truncates message bodies at ~40 chars. To extract the full error:

- Probe with multiple `query` values that are likely substrings of the error.
- Example: if you suspect a Prisma error, try `query: "PrismaClient"`, then `query: "P2022"`, then `query: "column"`, then specific column names from the schema.
- A match returning the same log entry confirms the substring is in the message.

If the route uses `console.error("...", err)` without `JSON.stringify`, the error object stringifies to `[object Object]` and disappears. Ship a quick diagnostic PR that wraps the catch with:

```ts
} catch (err) {
  const e = err as { message?: string; code?: string; meta?: unknown; name?: string };
  console.error("[route] error", JSON.stringify({
    name: e?.name ?? null,
    code: e?.code ?? null,
    message: e?.message ?? String(err),
    meta: e?.meta ?? null,
  }));
  return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
}
```

Auto-merge it. Ask the user to reproduce. Read the new structured log.

## 3 — Cross-check Sentry

If the route calls `reportApiError()` from `lib/observability/reportApiError.ts`, the error is also in Sentry tagged by `error_kind`. If not, **fix the route** to call `reportApiError()` — it's the project convention (CLAUDE.md §"API error handling"). Don't just `console.error` and move on.

## 4 — Identify the commit that introduced it

```bash
git log --oneline --since="<approximate date>" -- <suspect-file-or-folder>
```

Or by symptom — Prisma errors often correlate with schema changes:

```bash
git log --oneline -10 prisma/schema.prisma
```

## 5 — Always check DB schema drift first if it's Prisma

If the error contains `PrismaClient*Error`, before assuming the code is wrong:

```bash
# Use Neon DEV branch (active in .env.local) to verify schema
npx tsx --env-file=.env.local -e "
import { prisma } from './lib/prisma';
const r = await prisma.\$queryRaw\`SELECT column_name FROM information_schema.columns WHERE table_name='<Table>' ORDER BY column_name\`;
console.log(r);
await prisma.\$disconnect();
"
```

If a column the schema expects is missing in DB → migration not applied. See `migration-prisma` skill for the fix.

**Gotcha**: `.env.local` ACTIVE values point to the **Neon DEV branch** (`ep-restless-shadow-agvsrkje`). Prod is at `ep-still-pond-agbpuvs7` (commented out in `.env.local`). Always confirm which branch you're hitting before drawing conclusions.

## 6 — Vercel fire-and-forget gotcha

If the symptom is "cron ran but the Telegram never arrived" or "the email wasn't sent":

The route probably did `void sendTelegramMessage(...)` or `.then().catch()` without `await`. **Vercel kills Lambda execution as soon as `return NextResponse.json(...)` resolves** — anything still in the event loop is dropped silently.

Fix: `await` every side-effect AND persist the boolean result to `AgentLog.details.telegramSent` for audit:

```ts
const telegramSent = await sendTelegramMessage(message, { bot: "..." });
await prisma.agentLog.update({
  where: { id: logId },
  data: { details: { ...prevDetails, telegramSent } },
});
```

## 7 — When the bug is fixed

- Create a fiche in `docs/bugs/<symptom-slug>.md` (read existing ones for format)
- Include the `## 🤖 Automated detection` JSON block (http / sql / none) — the nightly cron at 02:07 UTC will run it
- Add a regression test in `tests/<topic>/`
- Update `brain/🐛 Bugs/` if the user has a related fiche there

## Anti-patterns

- ❌ Don't add `prisma as any` to silence a TypeError — it hides the bug
- ❌ Don't add `try { ... } catch {}` to bypass the symptom — fix the root cause
- ❌ Don't ship a "fix" without first having reproduced and understood the error message
- ❌ Don't assume Vercel cron fires Telegram correctly without an `AgentLog.details.telegramSent` audit trail
