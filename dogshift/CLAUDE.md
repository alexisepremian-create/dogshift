# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000, webpack mode)
npm run build            # prisma generate + Next.js build
npm run lint             # ESLint

npm test                 # Run unit tests (Node native test runner)
npm run test:watch       # Watch mode

npm run migrate:deploy   # Deploy pending Prisma migrations

npm run ship -- "msg"    # Commit all changes, push, open PR, enable auto-merge (see WORKFLOW.md)
```

## Shipping changes

See [`WORKFLOW.md`](./WORKFLOW.md). Happy path is `npm run ship -- "commit msg"`
— CI (lint + typecheck + unit tests + Next build + Playwright smoke tests)
gates every merge, so the script is safe to fire and forget.

Every bug fix **must** add at least one regression test in `tests/` (see
existing examples in `tests/validators/`, `tests/availability/`). API errors
must call `reportApiError()` from `lib/observability/reportApiError.ts` so
Sentry alerts catch spikes.

## Architecture

**DogShift** is a Swiss dog-sitting marketplace: dog owners book verified sitters. Built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Prisma + PostgreSQL (Neon), **Auth.js v5** for authentication (NOT Clerk — migrated away in May 2026, see [`docs/AUTH.md`](./docs/AUTH.md) for the full auth architecture), and Stripe Connect.

### Route Groups
- `app/(marketing)/` — Public pages: homepage with map, SEO sitter city pages, signup/login
- `app/(protected)/` — Authenticated dashboards for owners (bookings) and sitters (profile management)
- `app/(admin)/` — Internal tools for sitter verification and support
- `app/api/` — REST endpoints organized by resource (sitters, bookings, messages, stripe, admin, cron)

### Key Libraries (`/lib`)
- **`lib/availability/`** — Slot computation engine: computes available windows from recurring rules + date exceptions + existing bookings. Three service types with different constraints: Promenade (hourly), Dogsitting (daily), Pension (multi-day boarding).
- **`lib/stripe/`** — Payment intents, Stripe Connect onboarding for sitters, payout release, fee calculations.
- **`lib/email/`** — Transactional emails via Resend (primary) or SMTP (fallback). Falls back to `console.log` in dev if neither is configured.
- **`lib/validators/`** — Zod schemas for all API inputs (bookings, auth, contact forms).
- **`lib/prisma.ts`** — Prisma client singleton.

### Data Model Highlights
- **Users** have a dual role (owner and/or sitter). "Sitter" in the DB = dog owner; "host" = the sitter providing services.
- **Bookings** flow: `draft → confirmed → paid` with Stripe webhooks driving status transitions.
- **SitterProfile** tracks verification status + contract state; profiles only appear in search once fully verified and contract signed.
- **Availability** = weekly Rules + date-specific Exceptions, resolved against existing Bookings at query time (no pre-computed slots).
- **InviteCode / PilotSitterApplication** — pilot mode gating for controlled rollout.

### Booking Flow
1. Owner selects sitter + dates → checkout page validates via slot engine
2. `POST /api/bookings` creates booking + Stripe payment intent
3. Owner completes Stripe Checkout
4. `POST /api/stripe/webhooks` updates booking status → sends confirmation email + SMS

### Sitter Onboarding Flow
1. Application at `/become-sitter` → stored in `PilotSitterApplication`
2. Admin approves at `/admin/sitter-applications`
3. Sitter signs contract at `/contract/sign/[token]` → PDF saved to Cloudflare R2
4. Sitter completes Stripe Connect onboarding
5. Profile published and appears in `/sitters` search

## Infrastructure
- **Vercel** hosting with cron jobs defined in `vercel.json` (review request emails, payout releases, audit log cleanup)
- **Cloudflare R2** for contract PDFs and verification documents (S3-compatible via AWS SDK)
- **Vonage** for transactional SMS
- **Sentry** with custom PII scrubbing (GDPR/nLPD compliance — emails, names, phones filtered from events)

## Performance
See [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) for mobile homepage optimization rules.
Key constraints: no `backdrop-blur`, no `transition-all`, no `left`/`width` animation (use `transform`), no duplicate stateful components, single `StickySearchBar` instance only.

## Tests
Unit tests live in `tests/availability/` and cover the slot engine (day slots, multi-day status, range validation, boarding ranges). Tests run with `--experimental-strip-types` so TypeScript files execute directly without a build step.

## Environment Variables
Key variables needed in `.env.local`:
- `DATABASE_URL` + `DIRECT_URL` (Neon pooled + direct)
- **Auth.js v5** (see [`docs/AUTH.md`](./docs/AUTH.md) for details):
  - `AUTH_SECRET` (32-byte base64, sign JWTs — generate with `npx auth secret`)
  - `AUTH_TRUST_HOST=true` (required behind Cloudflare)
  - `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` (Google OAuth)
  - `ADMIN_EMAILS` (comma-separated whitelist for `/admin/*`)
  - `HOST_ADMIN_CODE` (strong password for the admin gate cookie)
- `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_MAPTILER_KEY` (map display)
- `RESEND_API_KEY` or SMTP vars for email
- `PILOT_MODE=true` + `PILOT_ADMIN_CODE` for invite-gated access
- `CONTRACT_TOKEN_SECRET` for contract signing tokens
- `NEXT_PUBLIC_APP_URL` for absolute URL generation
