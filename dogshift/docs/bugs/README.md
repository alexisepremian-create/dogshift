# Bug history & playbook

Each file in this folder documents a real production bug we hit, the root
cause we found, and the fix we shipped. Read these BEFORE attempting a fix
in the same area — most of these have recurred at least once, and the
playbook is faster than re-diagnosing.

Convention: filename = short kebab-case slug describing the symptom. The
fiche itself records the symptom, root cause, fix, PR link, and any
"things to NOT do" learned from prior attempts.

## UI / Navigation

- [`footer-flash-during-navigation.md`](./footer-flash-during-navigation.md) — the 1-frame footer reveal between Link click and PageLoader (3+ regressions, latest fix 2026-05-18)
- [`logout-bounce-back-to-dashboard.md`](./logout-bounce-back-to-dashboard.md) — `/sign-out` cleared the cookie but `/login` auto-redirected back to `/post-login` because `useSession()` cache lagged

## Auth & middleware

- [`middleware-bearer-auth-paths.md`](./middleware-bearer-auth-paths.md) — new `/api/{admin,host,account}/*` routes that auth via Bearer token must be whitelisted in `proxy.ts` or they 401 at the middleware

## Prisma / DB

- [`prisma-availability-rule-relation.md`](./prisma-availability-rule-relation.md) — `AvailabilityRule` belongs to `User`, not `SitterProfile`. `prisma as any` casts hide the type error.
- [`prisma-neon-cold-start.md`](./prisma-neon-cold-start.md) — crons firing at quiet hours need `ensurePrismaWarm()` retry — Neon autosuspends, first connection times out.

## Geo / Maps

- [`penthaz-geocoding.md`](./penthaz-geocoding.md) — MapTiler doesn't return coordinates for small Swiss villages. Hardcoded fallback in place; root cause not solved.

## Auth (historical, pre-Clerk-migration)

- [`clerk-v7-silent-errors.md`](./clerk-v7-silent-errors.md) — Clerk v7 changed the error shape; legacy `catch` blocks swallowed messages. Kept for historical context — DogShift now uses Auth.js v5.

## Mobile

- [`mobile-first-touch-delay.md`](./mobile-first-touch-delay.md) — first-touch on splash/modals/header needed two taps on iOS — `touch-action: manipulation` regression.

## Monitoring (not bugs, just things to watch)

- [`monitoring-pending-booking-expiry.md`](./monitoring-pending-booking-expiry.md)
- [`monitoring-stripe-payout-reconciliation.md`](./monitoring-stripe-payout-reconciliation.md)
