# Monitoring: PENDING_ACCEPTANCE bookings need to auto-expire

**Status:** Implemented (`/api/cron/expire-pending-bookings`), to be
watched in production. Not a bug per se — just a thing to keep an eye on.

## Description

Bookings in `PENDING_ACCEPTANCE` (paid but not yet accepted by the sitter)
must expire automatically after a configurable delay. The cron job does
this, but it isn't in `vercel.json` with an explicit schedule — verify
the production deployment is configured correctly.

## Actions

- [ ] Confirm the cron is scheduled in production Vercel
- [ ] Add a Sentry alert if `count(PENDING_ACCEPTANCE) > threshold`

## How a regression would look

- Bookings stuck in `PENDING_ACCEPTANCE` for days
- Owner complaints about paid bookings that never confirm
- Sitter complaints about not seeing the request

## 🤖 Automated detection

```json
{
  "type": "sql",
  "query": "SELECT COUNT(*)::int AS value FROM \"Booking\" WHERE status = 'PENDING_ACCEPTANCE' AND \"createdAt\" < NOW() - INTERVAL '7 days'",
  "expect_max": 0,
  "auto_fix": { "complexity": "complex" }
}
```

Counts bookings still in `PENDING_ACCEPTANCE` after 7 days. Any > 0 means the
expire cron isn't doing its job (or isn't scheduled). Auto-fix **complex** —
investigate cron logs before mass-cancelling rows.
