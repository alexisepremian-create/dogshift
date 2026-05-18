# Dev workflow

This is the short happy-path for shipping a change. Optimised for "I fixed a
small bug, I want it in prod in 5 minutes without breaking anything."

## TL;DR

```bash
# Edit files. Test locally with `npm run dev`.
# When it works:
npm run ship -- "fix(host): show Sitter city in booking confirmation"
```

That's it. You can close the terminal after `ship` prints the PR URL. GitHub
merges the PR itself the moment CI goes green (typically 3–6 minutes), then
Vercel auto-deploys `main` to prod.

## What `ship` actually does

1. Creates a branch `ship/<timestamp>-<slug>` (or reuses your current feature
   branch if you're not on `main`).
2. Stages every file changed, commits with your message, pushes.
3. Opens a Pull Request against `main`.
4. Enables **GitHub auto-merge** on that PR.

CI (see `.github/workflows/ci.yml`) runs on the push:

- `npm run lint`
- `tsc --noEmit` (typecheck)
- `npm test` (unit tests: availability engine, validators, Stripe helpers, …)
- `prisma generate && next build` (catches deploy-time regressions)
- Playwright smoke tests against the Vercel preview URL

When every check passes, GitHub squash-merges the PR and deletes the branch.
Vercel picks up the new `main` commit and rolls it out to prod. You get a Slack
DM from GitHub if anything fails; otherwise silence = success.

## First-time setup

Install the GitHub CLI and authenticate (only needed once per machine):

```bash
brew install gh
gh auth login        # pick: GitHub.com → HTTPS → login with web browser
```

`ship` refuses to run without this — it's what lets the script create PRs and
enable auto-merge from the terminal.

Repo-side, **auto-merge must be enabled** in GitHub for the feature to work:
`Settings → General → Pull Requests → Allow auto-merge` (tick it once, forever).

## Safety nets already in place

### Pre-commit hook

Husky runs `lint-staged` on every `git commit`. Only the files you staged are
re-linted (fast: <1s on a typical change). A broken lint = the commit is
aborted, so you can't accidentally push a syntax error.

To bypass in an emergency: `git commit --no-verify`. Don't make a habit of it.

### Regression tests

Every time a prod bug reaches a real user, we add a unit test that locks in the
fix. They live in `tests/` and run on every `npm test` / CI run. Examples:

- `tests/validators/hostProfileUpdateSchema.test.ts` — legacy avatars must keep
  passing validation. This prevents Sydney's "VALIDATION_ERROR" from ever
  coming back.
- `tests/validators/zodParseDetails.test.ts` — `VALIDATION_ERROR` responses must
  include a human-readable `details` string.
- `tests/availability/*.test.ts` — the slot engine for bookings.

**Rule**: every bug fix PR should add at least one assert that would have
caught the bug.

### Sentry alerting

Every API error we return (validation, auth, 500) is re-emitted as a tagged
Sentry event via `lib/observability/reportApiError.ts`. Tags:

- `error_kind` — `validation_error | forbidden | unauthorized | not_found | conflict | rate_limited | upstream_error | internal_error`
- `error_code` — the machine-readable code we returned in the JSON body
- `error_route` — optional logical route name

Recommended alert rules (set up once in Sentry dashboard → Alerts → Create Alert):

1. **Spike in validation errors** — *"number of events where `tags[error_kind]
   == validation_error` is > 30 in 10 min"*. Catches regressions where a form
   suddenly stops saving for every user.
2. **Any internal error** — *"1 event where `tags[error_kind] ==
   internal_error` in prod"*. Each 500 gets a page.
3. **Spike in forbidden / unauthorized** — *"> 50 events where `tags[error_kind]
   in [forbidden, unauthorized]` in 30 min"*. Catches broken auth deploys.

Route all three alerts to the same email / Slack channel; they're low-volume by
construction.

## When to deviate from `ship`

- **Very risky change** (DB migration, schema rename, payments): open the PR
  manually, don't enable auto-merge, eyeball the preview deploy, ask for a
  review.
- **Draft / WIP**: just `git push` to a `wip/…` branch. `ship` is for things
  you actually want merged.
- **Prod is on fire**: revert is always one command —
  `gh pr list --state merged --limit 5` → pick the culprit →
  `gh pr revert <number>`.

## Layout

- `dogshift/` — the Next.js app (this repo is mono-ish; the app is in a
  subfolder, and `core.hooksPath` is wired to `dogshift/.husky` by
  `scripts/setup-git-hooks.mjs`).
- `dogshift/scripts/ship.sh` — the one-command shipper.
- `dogshift/.husky/pre-commit` — lint-staged runner.
- `.github/workflows/ci.yml` — the gate between `ship` and prod.
