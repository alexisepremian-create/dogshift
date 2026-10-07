# Relaunch validation (isolated environment)

The local audit fixtures use `127.0.0.1:55437/dogshift_audit` only. The scripts refuse any other database. Never load a production `.env` or enable real email/SMS/Telegram providers for these tests. Fictional addresses end in `@example.test`.

1. Start a separate PostgreSQL 17 database on that local port and apply `prisma db push` to that database only.
2. Set `DATABASE_URL` and `DIRECT_URL` to the isolated database; run `node scripts/audit-local-seed.mjs`.
3. Start the app on port 3107 with `AUTH_SECRET=local-audit-only-secret-never-production`, `AUTH_TRUST_HOST=true`, `NEXT_PUBLIC_APP_URL=http://localhost:3107`, `STRIPE_WEBHOOK_SECRET=whsec_local_audit_only`. These are public test fixture values, never deployment credentials.
4. Set a dummy Stripe test key for purely simulated webhook tests, or a real **sandbox** secret/public key pair for Stripe integration tests. Include no email provider keys: delivery must use development logging.
5. Run `node scripts/audit-local-regression.mjs`. It exercises registration, account protection, automation authorization, avatar projection, all three booking services, signed webhooks, retry handling and sitter acceptance. Repeated runs cancel only unpaid fixture bookings in this isolated database.
6. Optionally run `node scripts/audit-local-stripe.mjs` with `AUDIT_STRIPE_ENV_FILE` pointing to a file containing sandbox credentials. The script rejects non-test keys and verifies `livemode=false` before creating/confirming payments. It calls the sandbox with `pm_card_visa`; it does not test production webhook connectivity, live transfers, TWINT, refunds or 3DS.

Normal checks: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build` with local/dummy configuration. Existing global lint debt is not waived by these regression tests.

Production release remains gated on explicit approval, environment isolation checks, a controlled email delivery test, verification of live webhook configuration, current sitter availability, and funnel configuration. Candidate records, invoices and private audit details are deliberately excluded from the repository.

## Follow-up booking safety and analytics

The pilot accepts exactly one owned dog per booking, with weight/sterilization read from the database. Creation, payment preparation and unpaid cancellation share a PostgreSQL transaction advisory lock per sitter. A pending checkout holds its slot for 30 minutes. When replacing an expired hold, the old Stripe intent must be canceled first; processing/successful payments or provider outages keep the slot reserved. No background cleanup or data deletion is required. The first pilot intentionally retains exclusive, non-overlapping bookings even for sitters with larger capacity.

Regression tests now cover simultaneous slot requests, stale holds, tampered dog size and sterilization, and multi-dog rejection. The sandbox script also exercises unpaid intent cancellation, expiry followed by replacement, and a real sandbox refund through the owner cancellation API. It never uses live keys.

Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` only after configuring a GA4 web stream. Disable **all Enhanced Measurement** in that stream (including history pageviews, forms, search and outbound clicks), Google Signals and ad personalization. Set event retention to two months. Validate with DebugView/network inspection before real traffic. The seven funnel events are in `lib/analytics/funnel.ts`; automatic pageviews and arbitrary parameters are excluded, and URLs/titles/referrers are normalized. No booking events go to Google without consent; no analytics rows are written to PostgreSQL. The consent cookie is versioned to request fresh agreement. The old Ads-only loader is replaced for this pilot.

`payment_start` fires when Stripe's PaymentElement is ready; `payment_success` requires a paid status from the authenticated backend. Reloads are deduplicated with session storage; the local dedupe key is never sent to Analytics. Browser tests use a fictional measurement ID and block all Google analytics requests, so test data does not enter any real property.

Sources for tag settings: https://developers.google.com/analytics/devguides/collection/ga4/reference/config and https://developers.google.com/analytics/devguides/collection/ga4/views . Account provisioning, active deployment variables and external delivery remain separate release checks.
