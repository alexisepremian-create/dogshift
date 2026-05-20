# Onboarding nudge sent to sitters whose only missing step is Stripe

**Status:** Fixed (PR `fix/prod-bugs-may-20`, May 20 2026)

## Symptom

Sitter Sylvana (profile 88 % complete in the DB — only Stripe Connect not
linked yet) reported receiving an email that said "Profil complété : 75 %"
and prompted her to "finaliser ton profil". She perceived this as wrong
because she had "filled in everything on the profile page" — Stripe Connect
is a separate external onboarding step (bank account verification) that she
mentally separates from "filling out the profile".

The 75 % figure in the email was actually correct **at the time it was sent**
(a previous day's run when she had 6/8 checks). She then added a 7th check,
bringing her to 87.5 % → rounded to 88. But she perceived the nudge as
nagging because it kept coming after she felt she was "done".

## Root cause

The cron `/api/cron/sitter-onboarding-nudge` (11:00 UTC daily) skips nudges
only when `completion >= 100`. A sitter at 87.5 % (7/8) where the only
missing item is `stripeConnected` was still receiving the generic
"finalize your profile" nudge.

Stripe Connect onboarding is qualitatively different from filling profile
fields :

- It requires the sitter to redirect to Stripe, prove identity, link a bank
  account — minutes of work, not seconds.
- It's already surfaced in the dashboard's `getHostTodos()` as
  "Configurer le compte de paiement" → `/host/wallet`.
- Pushing a generic "75 % profile complete, finalize it" email when 7/8 of
  the actual profile is done feels misleading.

## Fix

In `app/api/cron/sitter-onboarding-nudge/route.ts`, add a second skip
condition right after the `completion >= 100` check :

```ts
const { percent: completion, checks } =
  computeSitterProfileCompletionDetails(profileSnapshot);
if (completion >= 100) {
  results.skippedAlreadyComplete++;
  continue;
}
// Skip when ONLY Stripe Connect is missing — that step is surfaced in the
// dashboard's getHostTodos() and shouldn't trigger a generic "finalize
// your profile" nudge.
const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
if (missing.length === 1 && missing[0] === "stripeConnected") {
  results.skippedAlreadyComplete++;
  continue;
}
```

The dashboard banner ("Configurer le compte de paiement") remains the
nudge for Stripe — the right place for an action that requires leaving
the app.

## How to recognize a regression

- Sitter at 87 % completion reports a generic nudge email instead of a
  dashboard pointer
- `results.skippedAlreadyComplete` count in the cron's daily Telegram recap
  doesn't include 7/8 sitters (it should)

## What NOT to do

- ❌ Add a third skip rule for other missing items — only Stripe is the
  qualitative-different external step. Address, bio, services, avatar etc.
  are profile-field work and the nudge is appropriate.
- ❌ Hardcode the 87 % threshold — the rule is based on **what's missing**,
  not on a percentage. If a future migration changes the number of checks
  (currently 8), the % moves but the rule still works.

## Related

- `lib/sitterCompletion.ts` — `computeSitterProfileCompletionDetails()`
- `lib/hostProfile.ts` — `getHostTodos()` (dashboard todo list, still pushes
  Stripe Connect)

## 🤖 Automated detection

```json
{
  "type": "sql",
  "query": "SELECT COUNT(*)::int AS value FROM \"AgentLog\" WHERE \"agentName\" = 'sitter-onboarding-nudge' AND \"createdAt\" > NOW() - INTERVAL '7 days' AND \"details\"::text LIKE '%stripeOnlyNudgeSent%'",
  "expect_max": 0,
  "auto_fix": { "complexity": "simple" }
}
```

The detection assumes the AgentLog `details` field would surface a
`stripeOnlyNudgeSent` flag if the regression were to reappear. The cron
doesn't currently emit that flag — if we ever revert this fix, instrument
it before relying on the probe.
