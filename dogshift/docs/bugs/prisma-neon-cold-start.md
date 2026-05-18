# Neon cold-start times out scheduled crons

**Status:** Fixed (PR #334)

## Symptom

Cron jobs scheduled at quiet hours (e.g. 07:00 UTC) intermittently fail
with `PrismaClientInitializationError: Can't reach database server` on
the very first query. Subsequent retries succeed.

## Root cause

Neon autosuspends idle compute. When the cron fires after a long idle
period, the first connection attempt times out before Neon has finished
spinning up the compute. Prisma surfaces this as
`PrismaClientInitializationError`.

## Fix

Wrap the cron's first DB call with the `ensurePrismaWarm()` retry pattern.
See `app/api/cron/maintenance-recap/route.ts` for the canonical example.
Typically 2–3 retries with exponential backoff covers the worst case.

## How to recognize a regression

- `PrismaClientInitializationError` in Sentry, ONLY for cron routes
- Failure rate spikes at the cron's scheduled hour, then disappears
- Manual re-trigger (via `?force=1`) succeeds because Neon is now warm

## What NOT to do

- Do NOT increase Vercel's function timeout to mask this — the retry is
  cleaner and runs at < 200 ms.
- Do NOT keep Neon awake with a permanent ping job — costs $$ for no
  good reason.

## Related PRs

- PR #334 — `ensurePrismaWarm()` introduced for maintenance-recap cron

## 🤖 Automated detection

```json
{
  "type": "http",
  "url": "https://www.dogshift.ch/api/health",
  "expect_status": 200,
  "timeout_ms": 8000,
  "auto_fix": { "complexity": "complex" }
}
```

GET `/api/health` with an 8 s timeout. If Neon is too slow to warm, the
request times out → `fail`. Note: this is a flaky check by nature (Neon cold
starts are intermittent), so the nightly run at 02:07 UTC may catch the
worst-case latency. False positives are expected occasionally. Auto-fix
**complex** — the fix isn't a code patch but a config tune
(`ensurePrismaWarm` retry budget, or paying Neon for warm pool).
