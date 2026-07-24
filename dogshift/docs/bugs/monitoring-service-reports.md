# Monitoring : service-reports cron must stay deployed

**Status:** Active monitoring (PR `feat/service-report-cron`, 2026-07-24).

## What this fiche monitors

The `/api/cron/service-reports` route runs every 5 minutes and drives the two
sitter nudges of the "rapport de service" feature:

- **Selfie** at the service midpoint (hourly Promenade/Garde) or ~14:00 Zurich
  during a Pension stay → `serviceReportSelfie` notification + push.
- **Report reminder** just after the service ends (6h grace) → `serviceReportReminder`
  notification + push.

Idempotency is guaranteed by the notification `idempotencyKey`
(`serviceReportSelfie:{bookingId}:{zurichDay}` once/day, `serviceReportReminder:{bookingId}`
once ever), so re-runs never double-notify.

If this cron stops running, sitters silently stop being reminded to take a
selfie and to send the report — the whole feature degrades to "only if the
sitter remembers on their own", with no error surfaced anywhere.

## 🤖 Automated detection

```json
{
  "type": "http",
  "url": "https://www.dogshift.ch/api/cron/service-reports",
  "expect_status": 401,
  "auto_fix": { "complexity": "simple" }
}
```

The route is Bearer-gated (`CRON_SECRET` / `MAINTENANCE_API_KEY`), so an
unauthenticated GET must return **401**. A 404 means the route was removed or
failed to deploy; a 5xx means it crashes on cold start. Either is a regression.

## Recovery

- Manual trigger: `curl -H "Authorization: Bearer $MAINTENANCE_API_KEY" 'https://www.dogshift.ch/api/cron/service-reports'`
- A healthy response is `{ "ok": true, "processed": N, "selfies": …, "reports": …, "skipped": … }`.
- Check `/admin/agents` → **Rapports de service** for the live health probe.
- If 401 with a valid key: `CRON_SECRET` was rotated on Vercel without a redeploy.
- If Vercel's cron tab shows it paused: re-enable it (Pro plan required for the
  `*/5 * * * *` sub-hourly schedule).

## History

- 2026-07-24 — Cron introduced (PR4 of the service-report feature). Selfie +
  report nudges for all service types; pure timing logic in
  `lib/serviceReport/nudges.ts` with unit tests in `tests/serviceReport/nudges.test.ts`.
