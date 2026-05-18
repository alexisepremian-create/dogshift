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
