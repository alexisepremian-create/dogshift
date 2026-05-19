---
name: sentry-debug
description: Analyze Sentry events for DogShift, write/update alert rules, configure PII scrubbing (GDPR/nLPD compliance). Use when investigating an error spike, tuning Sentry tags, or adding observability to a new route.
---

# Sentry — DogShift

## Stack

- **Lib** : `@sentry/nextjs`
- **Config files** : `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`
- **DSN env** : `SENTRY_DSN`
- **Source maps upload** : `SENTRY_AUTH_TOKEN` (build-time)
- **Custom PII scrubbing** : emails, names, phones filtered before send (GDPR/nLPD compliance)

## The reporting helper

Always use `reportApiError()` in route handler catches :

```ts
import { reportApiError } from "@/lib/observability/reportApiError";

try {
  // …
} catch (err) {
  reportApiError({
    kind: "internal_error",          // closed enum — see below
    code: "FOO_OPERATION_FAILED",    // UPPER_SNAKE, app-defined
    route: "/api/foo",
    extra: { error: String(err) },   // anything non-PII for context
  });
  return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
}
```

**Don't just `console.error`.** Sentry alerts are configured on `error_kind` tags — bypassing the helper makes the alerts blind.

## `kind` is a closed enum

Pick exactly one :
- `validation_error` — Zod failure, malformed input
- `forbidden` — auth passed but action not allowed (role mismatch)
- `unauthorized` — no auth / expired
- `not_found` — resource ID doesn't exist
- `conflict` — race / dup / state mismatch
- `rate_limited` — too many requests
- `upstream_error` — Stripe / Resend / Vonage / R2 failed
- `internal_error` — unexpected, default catch-all

**Never invent a new kind** — Sentry alert rules match exactly. If your case doesn't fit, that's an ops conversation (new kind + new alert rules), not an inline fix.

## Configured alerts (live in Sentry dashboard)

| Alert | Condition | Goal |
|---|---|---|
| **Spike in validation errors** | `tags[error_kind] == validation_error` > 30 events / 10 min | Catch form regressions |
| **Any internal_error** | 1 event with `tags[error_kind] == internal_error` in prod | Page on every 500 |
| **Spike in forbidden/unauthorized** | `tags[error_kind] in [forbidden, unauthorized]` > 50 / 30 min | Catch broken auth deploys |

If you're tempted to add a 4th : likely a transient bug. Resolve at the source rather than alert.

## PII scrubbing (GDPR/nLPD)

`beforeSend` hooks in `sentry.{server,client,edge}.config.ts` strip :
- Emails (anywhere in messages, breadcrumbs, contexts)
- Names from user payloads
- Phone numbers
- Stripe customer / payment intent IDs (replaced with `[REDACTED]`)
- `Authorization` header value
- Cookies (full strip)

**Add a new PII field to scrub** when introducing a new sensitive concept (e.g. a sitter's IBAN, a contract token). Edit the `beforeSend` regex / lookup. Test locally :

```bash
npx tsx --env-file=.env.local scripts/sentry-scrub-test.ts <sample>
```

## When investigating a Sentry spike

### 1. Identify the kind

In Sentry UI, group by `error_kind` tag. Distribution gives you the bucket.

### 2. Drill into the top error_code

Each kind has multiple codes. Sort by frequency. Top code = root cause candidate.

### 3. Read the breadcrumbs

`route` tag points to the file. `extra.error` (when set) is the underlying message. Stack trace is symbolicated (source maps uploaded at build).

### 4. Cross-reference Vercel runtime logs

Sentry tells you it happened. Vercel logs tell you what was happening at the same time (slow queries, lambda cold starts, neighboring requests). Use the timestamp.

### 5. Reproduce locally before fixing

```bash
DATABASE_URL="$PROD_DIRECT" npx tsx -e "<reproduce the operation>"
```

(See `migration-prisma` skill for prod DB URL extraction pattern.)

## What NOT to do

- ❌ `console.error` in a catch without `reportApiError()` — alert blind
- ❌ Send raw user data to Sentry — PII compliance broken
- ❌ Invent a new `error_kind` — Sentry alerts won't match
- ❌ Sample below 100 % in prod — pilot phase, low volume, want every event
- ❌ Disable PII scrubbing "temporarily for debug" — leaves a security gap if forgotten
- ❌ Trust the Sentry timestamp blindly — clock skew between Vercel + Sentry can be ~30 s, cross-check with Vercel logs

## Adding observability to a new route

Standard checklist when shipping a new API route :

- [ ] `try { … } catch (err) { reportApiError({...}); return … }` wraps the whole handler
- [ ] `kind` picked from the closed enum
- [ ] `code` is UPPER_SNAKE and unique enough to filter on
- [ ] `route` matches the URL path
- [ ] `extra` includes useful context but NO PII
- [ ] If a happy-path event is rare and important (e.g. successful Stripe payout), also call `reportApiError({ kind: "..." })` to track success rate

## Where to look

- `lib/observability/reportApiError.ts` — the helper, single source of truth
- `sentry.server.config.ts` / `sentry.client.config.ts` / `sentry.edge.config.ts` — configs incl. PII scrubbing
- `docs/workflow.md` §"Sentry alerting" — official alert rules + recommended setup
- Sentry dashboard : alerts + tag explorers
