---
name: agent-write
description: Bootstrap a new autonomous agent in DogShift (cron, webhook, or hybrid) with full /admin/agents registration. Use whenever adding a new background logic that runs without user interaction. See docs/agents-convention.md.
---

# New autonomous agent — DogShift bootstrap

## Rule

> Every autonomous agent MUST appear in `/admin/agents`. Without exception.

An "autonomous agent" = any logic that runs **without direct user interaction**, on an external signal or schedule :

- **Cron** — schedule in `vercel.json` (or GitHub Actions for legacy n8n-era like deps-agent / deps-weekly)
- **Webhook** — endpoint that receives an external event (Cal.com, marketing forms, internal hooks)
- **Hybrid** — route callable by both cron and manually (ops, force re-run)

NOT agents : routes called synchronously by UI in normal flow (`/api/bookings`, `/api/auth/register`, etc.).

## Checklist when adding a new agent

### 1. Create the route

**Cron** : `app/api/cron/<id>/route.ts` — see `cron-write` skill for the full skeleton (CRON_SECRET auth, idempotency, Prisma warm, awaited Telegram, AgentLog persistence, reportApiError).

**Webhook** : `app/api/agents/<id>/route.ts` — pattern :

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Optional: HMAC signature verification (Cal.com pattern via lib/calcom/)
    // Optional: shared secret auth via Bearer token

    // Do the work, persist AgentLog
    const log = await prisma.agentLog.create({
      data: { agentName: "<id>", actionType: "...", summary: "...", details: body },
    });

    // Telegram notification — fire-and-forget OK for webhooks (user-facing context)
    void sendTelegramMessage(`...`, { bot: "<bot>" }).catch(() => {});

    return NextResponse.json({ ok: true, logId: log.id });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "<AGENT_ID>_WEBHOOK_FAILED",
      route: "/api/agents/<id>",
      extra: { error: String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
```

### 2. Add to `ROUTE_MAP` in `app/api/admin/agents-health/route.ts`

```ts
"<id>": "/api/cron/<id>",   // or "/api/agents/<id>"
```

Without this, the liveness ping marks the agent "unknown" in `/admin/agents`.

### 3. Add to `AGENTS[]` in `app/(protected)/admin/agents/page.tsx`

```ts
{ id: "<id>", name: "<Display Name>", description: "<what it does + when>", icon: "<LucideIcon>" },
```

### 4. Add to `COLORS` map in same file

```ts
"<id>": { icon: <LucideIcon>, color: "#hex", bg: "#hex" },
```

(import the lucide icon at top of file if not already)

### 5. Add to the right "zone"

In same `page.tsx`, append to one of :
- `FREE_AGENTS` — standalone, no orchestration
- `MAESTRO_CHILDREN` — orchestrated by Maestro
- `CANDIDATURE_CHILDREN` — sub-agent of candidature scoring

If `FREE_CX` array is too short, extend it (one extra coordinate per added free agent).

### 6. Register the schedule (cron only)

`vercel.json` :
```json
{ "path": "/api/cron/<id>", "schedule": "53 6 * * *" }
```

Pick a non-round minute (`:00` and `:30` cluster on Vercel's fleet).

### 7. Create the brain fiche

`brain/🤖 Agents/<Name>.md` — keep brief :
- Trigger / schedule
- What it does (1-3 bullets)
- Side effects (emails, Telegram, DB writes)
- Failure mode + recovery
- Links to related agents

### 8. (Bug-fix style) Add regression test

If the agent has non-trivial logic, add a test in `tests/integrations/<id>.test.ts`. At minimum, lock in the structural invariants (route exists, ROUTE_MAP entry, vercel.json schedule).

## Naming convention

Agent IDs : `kebab-case`. Match folder name. Match `AGENTS[].id`.

Existing examples : `bug-regression-check`, `sitter-onboarding-nudge`, `prisma-migration-status`, `lead-magnet`, `onboarding-owner`, `zootherapie-evaluation`.

## AgentLog discipline

Every agent run should write at least one `AgentLog` row :

```ts
await prisma.agentLog.create({
  data: {
    agentName: "<id>",
    actionType: "<what kind of run>",  // for idempotency keys: use ISO date for daily idempotent crons
    summary: "<human-readable>",
    details: { ...stats, telegramSent, emailSent },
    targetId: <userId|sitterId|null>,  // for filtering admin views
    status: "ok" | "warning" | "error",
    durationMs: Date.now() - startMs,
  },
});
```

The admin dashboard reads from this table — agents without recent logs show as "stale".

## Anti-patterns

- ❌ Add an agent without `/admin/agents` registration → invisible = doesn't exist for Alexis
- ❌ Use a route under `/api/{host,account,admin}/*` for an agent → middleware will 401 unless whitelisted in `BEARER_AUTH_API_PATHS`
- ❌ Skip the AgentLog write → no audit, no admin visibility
- ❌ Per-record Telegram in a cron loop → spam. Use grouped recap (see `telegram-format` skill)
- ❌ Forget `?force=1` bypass for ops → can't manually re-run a stuck cron
- ❌ Forget idempotency check → cron retries duplicate the work

## Where to look

- `docs/agents-convention.md` — official checklist
- `brain/🤖 Agents/` — all existing agent fiches (19 at last count)
- `brain/🧠 Décisions/Conventions cron DogShift.md` — cron skeleton reference
- `app/api/cron/maintenance-recap/route.ts` — canonical cron example
- `app/api/agents/calendrier/route.ts` — canonical webhook example (HMAC + Telegram)
- `app/api/admin/agents-health/route.ts` — health check ROUTE_MAP
- `app/(protected)/admin/agents/page.tsx` — visual canvas
