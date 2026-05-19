# Prisma migration silently skipped on Vercel prod deploy

**Status:** Fixed (2026-05-19 — manual `ALTER TABLE` + insert into `_prisma_migrations` on prod Neon; CI guard added in PR #386).

## Symptom

The admin candidatures page (`/admin/sitters/applications`) loaded but the
panel showed `Impossible de charger les candidatures.` and DevTools Network
showed:

```
GET /api/admin/pilot-sitter-applications → 500
{"ok": false, "error": "INTERNAL_ERROR"}
```

Vercel runtime logs showed `PrismaClientKnownRequestError` mentioning
`PilotSitterApplication` and the word "column".

## Root cause

Migration `20260518170000_add_address_to_sitter_application` (PR #350,
2026-05-18) added a nullable `address` column to `PilotSitterApplication`.
The Prisma schema and generated client matched. **The migration was never
applied to the prod Neon branch** (`ep-still-pond-agbpuvs7`) despite
Vercel's `vercel-build` running `prisma migrate deploy && prisma generate
&& next build` on every deploy.

`_prisma_migrations` last entry was `20260511200000_add_admin_role` from
May 11 — eight days and 4+ deploys (#379, #380, #381, #384, #385) had
shipped after the migration was added, and none of them applied it.

When the admin route's `prisma.pilotSitterApplication.findMany()` (no
explicit `select`) ran, Prisma generated `SELECT … "address" … FROM
"PilotSitterApplication"` which Postgres rejected with `P2022 column
"address" does not exist` → 500.

Why `prisma migrate deploy` skipped the file is still **not understood**:

- The file exists in `prisma/migrations/` at the right path
- `migration_lock.toml` is correct
- No `prisma generate` error visible in build logs
- The deployments that followed were full rebuilds (not cached)

Working hypotheses:
- Vercel had a stale build cache for the prisma layer that kept restoring
  the pre-May-18 client and skipping the new file
- Neon's direct-URL was unreachable during the May 19 production builds
  (Neon autosuspend race) and the migration step fell through silently
- The build's `prisma migrate deploy` exited 0 despite skipping (no
  --exit-with-pending-status flag)

Investigation TBD — see "How to harden" below.

## Fix (manual, immediate)

Apply the ALTER + record it in `_prisma_migrations` on the prod DB so
future `prisma migrate deploy` doesn't try to re-apply:

```bash
PROD_DIRECT=$(grep "DIRECT_URL.*ep-still-pond" .env.local | sed 's/^# //' | head -1 | sed 's/^DIRECT_URL=//; s/^"//; s/"$//')

DATABASE_URL="$PROD_DIRECT" npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
await p.\$executeRaw\`ALTER TABLE \"PilotSitterApplication\" ADD COLUMN IF NOT EXISTS \"address\" TEXT\`;
await p.\$executeRaw\`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (gen_random_uuid()::text, 'manual-' || extract(epoch from now())::text, NOW(), '20260518170000_add_address_to_sitter_application', null, null, NOW(), 1)\`;
await p.\$disconnect();
"
```

## Fix (preventive — CI guard)

Add a `prisma migrate status` step to the `quality` CI job that fails the
build when there are pending migrations on the prod DB. Forces the
operator to investigate before merging.

See `.github/workflows/ci.yml` step `prisma-migration-status` (PR #386).

## How to recognize a regression

- A route doing `prisma.<model>.findMany()` (no explicit `select`) suddenly
  returns 500 in prod but works fine locally.
- The model has had a recent ADD COLUMN migration that nobody verified
  was applied.
- Vercel logs show `PrismaClientKnownRequestError` containing the column
  name.

## What NOT to do when fixing it again

- Do **not** add `select: { ... }` to every `findMany` to dodge unknown
  columns. That hides the real problem (drift between Prisma schema and
  DB) and creates a maintenance trap whenever someone adds a field.
- Do **not** edit migration filenames or rename existing ones to "retry"
  a migration. That confuses `_prisma_migrations` further.
- Do **not** `npx prisma migrate reset` on prod. Ever.
- Do **not** apply the ALTER from the dev branch's connection string.
  The `.env.local` ACTIVE values point to the Neon **dev** branch
  (`ep-restless-shadow-agvsrkje`). The prod URLs are **commented out**
  and clearly labelled "DATABASE_URL prod main - NE PAS UTILISER EN DEV
  LOCAL". Read the comments. (May 19 2026 — got bitten by this exact
  trap; spent 5 minutes "fixing" the dev branch before realising prod was
  still broken.)

## Related PRs

- PR #350 — added the `address` column / migration (2026-05-18)
- PR #385 — diagnostic logging (`JSON.stringify({ name, code, message, meta })`)
  that surfaced `P2022` in Vercel logs
- PR #386 — CI guard via `prisma migrate status`

## 🤖 Automated detection

```json
{
  "type": "sql",
  "query": "SELECT (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PilotSitterApplication' AND column_name = 'address') THEN 0 ELSE 1 END)::int AS value",
  "expect_max": 0,
  "auto_fix": { "complexity": "complex" }
}
```

Returns 0 if the `address` column exists on the prod DB, 1 if missing.
This is a single-point probe (only this one migration) — it does NOT
generalize to detecting any future skipped migration. The real defence
is the `prisma migrate status` CI step in PR #386, which catches drift
before deploy regardless of which migration is missing.

If the CI step itself ever gets bypassed (rollback, infra change), this
SQL probe is the safety net for this specific incident.
