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
