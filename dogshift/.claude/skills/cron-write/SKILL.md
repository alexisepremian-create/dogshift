---
name: cron-write
description: Bootstrap a new Vercel cron route in DogShift with all the project conventions wired (CRON_SECRET auth, MAINTENANCE_API_KEY override, AgentLog idempotency, Prisma warm-up, awaited Telegram + audit, Sentry on error, register in vercel.json + /admin/agents). Use when adding any new scheduled job.
---

# New Vercel cron — DogShift bootstrap

## Checklist

Every cron MUST :

1. Live under `app/api/cron/<name>/route.ts`
2. Use `runtime = "nodejs"` (NOT edge — Prisma incompatible)
3. Auth via Bearer `CRON_SECRET` (Vercel) OR `MAINTENANCE_API_KEY` (manual)
4. Be idempotent (one `AgentLog` row per UTC day OR per natural unit — `force=1` bypass)
5. Warm up Prisma before first query (Neon autosuspend resilience)
6. **Await** every Telegram / email / external call (Vercel kills lambdas after response)
7. Persist `details.telegramSent` (or equivalent) for silent-fail audit
8. Call `reportApiError()` in catch blocks (Sentry convention)
9. Be registered in `vercel.json` `crons[]`
10. Be wired into `/admin/agents` (page.tsx COLORS + AGENTS + FREE_AGENTS) + `agents-health` ROUTE_MAP

## Skeleton

```ts
/**
 * <Name>.
 *
 * <One paragraph of what this does + why.>
 *
 * Schedule: <HH:MM> UTC daily (see vercel.json).
 *
 * Auth: Bearer CRON_SECRET (Vercel) or MAINTENANCE_API_KEY (manual).
 *
 * Idempotency: <one AgentLog row per UTC day / per natural unit>.
 *   Re-running is a no-op unless `?force=1` is passed.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { reportApiError } from "@/lib/observability/reportApiError";
import { tgFooter, tgHeader, tgSection } from "@/lib/telegram/format";

export const runtime = "nodejs";
export const maxDuration = 60; // bump to 300 if needed

async function ensurePrismaWarm(): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      return;
    } catch (err) {
      lastErr = err;
      const isInitErr =
        err instanceof Error &&
        (err.name === "PrismaClientInitializationError" ||
          /can't reach database|connection|timeout/i.test(err.message));
      if (!isInitErr) throw err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr ?? new Error("Prisma warm-up failed");
}

export async function GET(req: Request) {
  // ── Auth ──
  const authHeader = req.headers.get("authorization") ?? "";
  const cronBearer = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const maintBearer = `Bearer ${(process.env.MAINTENANCE_API_KEY ?? "").trim()}`;
  const isAuthorized =
    (process.env.CRON_SECRET && authHeader === cronBearer) ||
    (process.env.MAINTENANCE_API_KEY && authHeader === maintBearer);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const todayKey = new Date().toISOString().slice(0, 10);

  // ── Idempotency ──
  if (!force) {
    const already = await prisma.agentLog.findFirst({
      where: { agentName: "<agent-name>", actionType: todayKey },
    });
    if (already) {
      return NextResponse.json({
        ok: true,
        skipped: "already_ran_today",
        runAt: already.createdAt,
      });
    }
  }

  // ── Warm DB ──
  try {
    await ensurePrismaWarm();
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "<AGENT_NAME>_PRISMA_WARM_FAILED",
      route: "/api/cron/<name>",
      extra: { error: String(err) },
    });
    return NextResponse.json({ ok: false, error: "PRISMA_WARM_FAILED" }, { status: 500 });
  }

  try {
    // ── Work ──
    // … do the actual work, accumulate results
    const stats = { processed: 0, sent: 0, errors: 0 };

    // ── Telegram recap (ONLY IF there's something to report) ──
    let telegramSent = false;
    if (stats.sent > 0 || stats.errors > 0) {
      const now = new Date();
      const message = [
        tgHeader("🔧", "<Cron name>", now),
        "",
        tgSection("📊", "Résumé"),
        `${stats.sent} envoyés · ${stats.errors} erreur(s)`,
        "",
        tgFooter(now),
      ].join("\n");

      // CRITICAL: await — Vercel kills fire-and-forget
      telegramSent = await sendTelegramMessage(message, {
        bot: "<bot>",
        parseMode: "HTML",
      });
    }

    // ── Persist run ──
    await prisma.agentLog.create({
      data: {
        agentName: "<agent-name>",
        actionType: todayKey,
        summary: `${stats.sent} sent, ${stats.errors} errors`,
        details: { ...stats, telegramSent },
        status: stats.errors > 0 ? "warning" : "ok",
      },
    });

    return NextResponse.json({ ok: true, ...stats, telegramSent });
  } catch (err) {
    const e = err as { message?: string; code?: string };
    console.error(
      "[api][cron][<name>] error",
      JSON.stringify({ code: e?.code, message: e?.message }),
    );
    reportApiError({
      kind: "internal_error",
      code: "<AGENT_NAME>_FAILED",
      route: "/api/cron/<name>",
      extra: { error: String(err) },
    });
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
```

## Register the cron

### `vercel.json`

```json
{
  "path": "/api/cron/<name>",
  "schedule": "53 6 * * *"
}
```

**Pick a non-round minute** to avoid bunching on the fleet (avoid `:00`, `:30`).

### `/admin/agents` page

Edit `app/(protected)/admin/agents/page.tsx` :

1. Import the lucide icon (e.g. `Database`)
2. Add to `COLORS` map :
   ```ts
   "<name>": { icon: Database, color: "#16a34a", bg: "#f0fdf4" },
   ```
3. Add to `AGENTS[]` :
   ```ts
   { id: "<name>", name: "<Display Name>", description: "...", icon: "Database" },
   ```
4. Add to `FREE_AGENTS` (or `MAESTRO_CHILDREN` if it's orchestrated)
5. If `FREE_CX` is too short, extend it (one extra position per agent)

### `agents-health` ROUTE_MAP

`app/api/admin/agents-health/route.ts` :

```ts
"<name>": "/api/cron/<name>",
```

## Test plan

- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] Manual trigger : `curl -H "Authorization: Bearer $CRON_SECRET" "https://www.dogshift.ch/api/cron/<name>?force=1"`
- [ ] Verify Telegram arrives (or doesn't, if nothing to report)
- [ ] Verify `AgentLog` row exists with `details.telegramSent: true`
- [ ] Check `/admin/agents` shows the new agent as online

## Anti-patterns

- ❌ Forgetting `await` on Telegram → silent drop after `return NextResponse.json(...)`
- ❌ Forgetting idempotency check → cron re-runs duplicate the work
- ❌ Edge runtime → Prisma fails
- ❌ Logging without `JSON.stringify(err)` → Vercel truncates `[object Object]`
- ❌ Per-sitter Telegram message in a loop → spam
- ❌ Bare `CRON_SECRET` check without `MAINTENANCE_API_KEY` fallback → no manual ops

## Bonus : if your cron must be whitelisted in middleware

`proxy.ts` protects `/api/{host,account,admin}/*`. Crons under `/api/cron/*` are public-routing-wise but the Bearer auth in the handler is what protects them. No middleware change needed.

If you add a cron under `/api/admin/maintenance/<x>` (rare), you MUST add it to `BEARER_AUTH_API_PATHS` in `proxy.ts` — otherwise middleware 401s before the route runs (PRs #329, #335 burned on this).

## Where to look

- `app/api/cron/maintenance-recap/route.ts` — canonical example (idempotency + warm + Telegram + agentLog)
- `app/api/cron/sitter-onboarding-nudge/route.ts` — per-sitter loop + grouped recap
- `app/api/cron/prisma-migration-status/route.ts` — minimal example (no loop, no idempotency since cheap)
- `vercel.json` — see existing schedules
- `docs/agents-convention.md` — full agent registration checklist
