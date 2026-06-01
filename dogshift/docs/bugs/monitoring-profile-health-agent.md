# Monitoring : profile-health agent must run daily

**Status:** Active monitoring (PR `feat/profile-health-agent`, 2026-06-01).

## What this fiche monitors

The `/api/cron/profile-health-check` route runs daily at 04:13 UTC and is the
primary line of defense against the class of bug Sonia hit in March + May
(published profile blocked by a server-side gate the UI doesn't surface).

If this cron stops running, we lose:
- Daily invariant checks on every (User, SitterProfile)
- Auto-fix of `SERVICES_DESYNC` / `DOG_SIZES_DESYNC` / `COMPLETION_CACHE_STALE`
- Synthetic HTTP probes against the public site

…so the regression detection latency goes from < 24h back to "until a user
complains". Critical to keep this one running.

## 🤖 Automated detection

```json
{
  "type": "sql",
  "description": "Last successful profile-health run must be within the last 26 hours.",
  "query": "SELECT 1 FROM \"AgentLog\" WHERE \"agentName\" = 'profile-health' AND status = 'success' AND \"createdAt\" > NOW() - INTERVAL '26 hours' LIMIT 1",
  "expect_rows": 1,
  "auto_fix": { "complexity": "complex" }
}
```

If the query returns zero rows, the daily cron either failed or never ran.
Likely causes :
1. Vercel cron paused (check the project's cron tab)
2. Bearer auth misconfig (`CRON_SECRET` rotated without redeploy)
3. Neon DB cold-start exceeded the 3-retry warm-up (rare, check Sentry)
4. `MAINTENANCE_API_KEY` swapped on Vercel but not in GitHub Actions

Auto-fix is marked **complex** because the right repair depends on which of
the four happened — no safe one-click resolution.

## Recovery

- Manual trigger : `curl -H "Authorization: Bearer $MAINTENANCE_API_KEY" 'https://www.dogshift.ch/api/cron/profile-health-check?force=1'`
- Check the response body — `success: true` + counts means the agent itself works, the issue is cron scheduling
- Check `/admin/profile-health` for the last-run timestamp
- Check `/admin/agents` for the live health probe

## History

- 2026-06-01 — Agent introduced (PR `feat/profile-health-agent`) alongside admin impersonation. Initial run reproduced Sonia's TERMS_MISSING_BUT_PUBLISHED bug visibly in the Telegram recap, validating the loop.
