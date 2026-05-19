---
name: migration-prisma
description: Manage Prisma migrations on DogShift's Neon DB (dev branch + prod). Detect drift, manually apply a skipped migration on prod, verify _prisma_migrations table state. Use whenever a 500 mentions `PrismaClient*Error`, a column appears missing, or after merging a PR that adds/changes prisma/schema.prisma.
---

# Prisma migrations — DogShift

## Critical context

`.env.local` has TWO Neon connection strings — read the comments before running anything:

| Branch | Host | Status in env.local |
|---|---|---|
| **dev** | `ep-restless-shadow-agvsrkje` | **ACTIVE** (uncommented) |
| **prod** | `ep-still-pond-agbpuvs7-pooler` / `ep-still-pond-agbpuvs7` | **commented out** ("DATABASE_URL prod main - NE PAS UTILISER EN DEV LOCAL") |

When the user reports a prod bug, the dev branch is **not authoritative**. Pull the prod URL from the commented lines:

```bash
PROD_DIRECT=$(grep "DIRECT_URL.*ep-still-pond" .env.local | sed 's/^# //' | head -1 | sed 's/^DIRECT_URL=//; s/^"//; s/"$//')
```

## Verify what's applied on prod

```bash
DATABASE_URL="$PROD_DIRECT" npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r: any = await p.\$queryRaw\`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 20\`;
r.forEach((m: any) => console.log(m.migration_name, '|', m.finished_at, '|', m.rolled_back_at));
await p.\$disconnect();
"
```

Compare against `ls prisma/migrations/` — any migration on disk that's NOT in `_prisma_migrations` (or has `rolled_back_at != null`) is **pending** and is probably the root cause.

The daily cron `/api/cron/prisma-migration-status` (06:53 UTC) does this automatically and alerts via the maintenance Telegram bot — see `docs/bugs/prisma-migration-not-applied-on-prod.md`.

## Apply a missed migration manually

When `prisma migrate deploy` has silently skipped a migration (this happened on May 19 2026), apply it directly:

```bash
DATABASE_URL="$PROD_DIRECT" npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
// 1. Apply the actual schema change (idempotent — use IF NOT EXISTS for ADD COLUMN)
await p.\$executeRaw\`ALTER TABLE \"X\" ADD COLUMN IF NOT EXISTS \"y\" TEXT\`;
// 2. Register the migration so future deploys don't try to re-apply
await p.\$executeRaw\`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (gen_random_uuid()::text, 'manual-' || extract(epoch from now())::text, NOW(), '<full_migration_name>', null, null, NOW(), 1)\`;
await p.\$disconnect();
"
```

`<full_migration_name>` = exactly the folder name in `prisma/migrations/`, e.g. `20260518170000_add_address_to_sitter_application`.

Then re-trigger the failing route to confirm.

## Writing a new migration

DogShift uses hand-written additive migrations (not `prisma migrate dev`, which would reset the shared Neon branch). Pattern:

1. Edit `prisma/schema.prisma`
2. Create `prisma/migrations/<YYYYMMDDhhmmss>_<slug>/migration.sql` with `ALTER TABLE … ADD COLUMN …`
3. Run `npx prisma generate` to regenerate the client
4. Commit + PR — Vercel's `vercel-build` runs `prisma migrate deploy` on each deploy

**Critical**: use `ADD COLUMN IF NOT EXISTS` so the migration is idempotent even if it gets manually applied first (rescue scenario).

## Test the schema before merging

Before merging a schema-changing PR, verify it builds clean:

```bash
npx prisma generate
npx tsc --noEmit
npm test
```

After merging — within 5 minutes — verify the migration ran on prod via the next-day `/api/cron/prisma-migration-status` cron, or trigger it manually:

```bash
CRON_SECRET=$(grep ^CRON_SECRET= .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
curl -H "Authorization: Bearer $CRON_SECRET" "https://www.dogshift.ch/api/cron/prisma-migration-status"
```

Response includes `pending` array — empty = clean.

## Anti-patterns

- ❌ `npx prisma migrate reset` — never on prod, ever
- ❌ Renaming an existing migration folder to "retry" it — confuses `_prisma_migrations` further
- ❌ Editing `_prisma_migrations` to skip a migration — fix the underlying schema mismatch instead
- ❌ Adding `select: { ... }` to `findMany` calls to dodge a missing column — that hides the drift bug
- ❌ Applying ALTER on the dev branch and assuming prod is fixed — verify which host you connected to
