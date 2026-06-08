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
  "description": "Last profile-health run must be within the last 26 hours.",
  "query": "SELECT (CASE WHEN EXISTS (SELECT 1 FROM \"AgentLog\" WHERE \"agentName\" = 'profile-health' AND \"createdAt\" > NOW() - INTERVAL '26 hours') THEN 0 ELSE 1 END)::int AS value",
  "expect_max": 0,
  "auto_fix": { "complexity": "complex" }
}
```

Convention rappelée : le runner de `lib/bugRegression/runDetections.ts` attend
une requête qui retourne **une seule ligne avec une colonne `value` numérique**
et compare à `expect_max` (par défaut 0). L'ancien format `expect_rows: 1`
n'est pas supporté — il faisait `SQL returned non-numeric value: undefined`
chaque nuit dans le récap maintenance (audit 2026-06-08).

La requête ci-dessus inverse la logique :

- profile-health a tourné dans les dernières 26 h → `value = 0` → ✅ pass.
- profile-health n'a PAS tourné dans les dernières 26 h → `value = 1` → 🚨
  fail. C'est exactement la signature d'une régression (cron silencieusement
  cassé), ce que cette fiche est censée détecter.

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
