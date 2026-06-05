# Bug history & playbook

Each file in this folder documents a real production bug we hit, the root
cause we found, and the fix we shipped. Read these BEFORE attempting a fix
in the same area — most of these have recurred at least once, and the
playbook is faster than re-diagnosing.

Convention: filename = short kebab-case slug describing the symptom. The
fiche itself records the symptom, root cause, fix, PR link, and any
"things to NOT do" learned from prior attempts.

## 🌙 Nightly regression check

The cron `/api/cron/bug-regression-check` runs every day at **02:07 UTC** and
re-reads **every** fiche in this folder. New fiches are auto-detected — just
add the file. The cron extracts the optional `## 🤖 Automated detection`
JSON block from each fiche and runs it (HTTP probe or SQL query). Results go
to the maintenance Telegram bot every morning, regardless of whether anything
failed (it's the daily proof-of-work).

When adding a NEW fiche, also add the detection block. Schema in
`lib/bugRegression/parseBugFiches.ts`; full convention in
`brain/🐛 Bugs/Workflow.md`. Three types:

```json
{ "type": "http", "url": "...", "expect_status": 200, "auto_fix": { "complexity": "complex" } }
{ "type": "sql",  "query": "SELECT COUNT(*)::int AS value FROM ...", "expect_max": 0, "auto_fix": { "complexity": "simple" } }
{ "type": "none", "reason": "documented why no auto-check is feasible" }
```

`auto_fix.complexity` = `"simple"` → eligible for automated PR + auto-merge
(once a patch script is wired). `"complex"` → cron only alerts; humans fix.

## UI / Navigation

- [`footer-flash-during-navigation.md`](./footer-flash-during-navigation.md) — the 1-frame footer reveal between Link click and PageLoader (3+ regressions, latest fix 2026-05-18)
- [`logout-bounce-back-to-dashboard.md`](./logout-bounce-back-to-dashboard.md) — `/sign-out` cleared the cookie but `/login` auto-redirected back to `/post-login` because `useSession()` cache lagged

## CI / Tests

- [`e2e-smoke-body-text-too-short.md`](./e2e-smoke-body-text-too-short.md) — smoke test reads body at domcontentloaded → sees only the PageLoader → fails. False positive blocking all queued PRs.

## Auth & middleware

- [`middleware-bearer-auth-paths.md`](./middleware-bearer-auth-paths.md) — new `/api/{admin,host,account}/*` routes that auth via Bearer token must be whitelisted in `proxy.ts` or they 401 at the middleware

## Prisma / DB

- [`prisma-availability-rule-relation.md`](./prisma-availability-rule-relation.md) — `AvailabilityRule` belongs to `User`, not `SitterProfile`. `prisma as any` casts hide the type error.
- [`prisma-neon-cold-start.md`](./prisma-neon-cold-start.md) — crons firing at quiet hours need `ensurePrismaWarm()` retry — Neon autosuspends, first connection times out.

## Geo / Maps

- [`penthaz-geocoding.md`](./penthaz-geocoding.md) — MapTiler doesn't return coordinates for small Swiss villages. Hardcoded fallback in place; root cause not solved.

## Mobile

- [`mobile-first-touch-delay.md`](./mobile-first-touch-delay.md) — first-touch on splash/modals/header needed two taps on iOS — `touch-action: manipulation` regression.
- [`native-app-footer-flash-on-launch.md`](./native-app-footer-flash-on-launch.md) — Capacitor iOS/Android cold launch showed the web marketing footer instead of NativeMapHome (post-splash 200 ms-5 s window). Fixed via inline `<head>` Capacitor detect + CSS purple overlay until bridge init completes.

## Monitoring (not bugs, just things to watch)

- [`monitoring-pending-booking-expiry.md`](./monitoring-pending-booking-expiry.md)
- [`monitoring-stripe-payout-reconciliation.md`](./monitoring-stripe-payout-reconciliation.md)
