---
name: prisma-schema
description: Design or modify a Prisma model in DogShift (new fields, relations, indexes, enum values, migrations). Use when editing prisma/schema.prisma, planning a schema change, or debugging a relation issue.
---

# Prisma schema — DogShift

## Hand-written migrations, NOT `prisma migrate dev`

DogShift's prod DB is a shared Neon branch. `prisma migrate dev` would reset it. **NEVER run it**.

Workflow :
1. Edit `prisma/schema.prisma`
2. Create `prisma/migrations/<YYYYMMDDhhmmss>_<slug>/migration.sql` BY HAND
3. Run `npx prisma generate` to refresh the client
4. Commit + open PR — Vercel's `vercel-build` runs `prisma migrate deploy` on each deploy
5. Verify with the daily `/api/cron/prisma-migration-status` cron the next morning

## Migration file naming

Format : `YYYYMMDDhhmmss_<slug>` (matches `migration_lock.toml` ordering).

Use today's UTC timestamp. Slug in lowercase snake_case, descriptive :

```
20260518170000_add_address_to_sitter_application
20260511200000_add_admin_role
20260509000000_conversation_pin_archive_delete
```

## Idempotent SQL

Every migration must be idempotent (so manual re-application is safe) :

```sql
-- ADD COLUMN — always IF NOT EXISTS
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "newField" TEXT;

-- ADD ENUM VALUE — always IF NOT EXISTS
ALTER TYPE "SitterApplicationStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- CREATE TABLE — always IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "NewModel" ( ... );

-- CREATE INDEX — always IF NOT EXISTS
CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status");
```

The `IF NOT EXISTS` is load-bearing — May 19 2026 incident proved that prod migrations can be skipped, and the manual recovery script uses these idempotency clauses.

## Model conventions

### Primary keys

`String @id @default(cuid())` for app-level models. NOT `Int` autoincrement (cuid is URL-safe, no leakage, no race).

### Timestamps

```prisma
createdAt   DateTime  @default(now())
updatedAt   DateTime  @updatedAt
```

Every model has these. Audit + sort by recency.

### Soft delete

Pattern when needed :
```prisma
archivedAt  DateTime?
```

Filter in queries with `where: { archivedAt: null }`. Don't DELETE rows that could be referenced (Bookings, Messages, AuditLog).

### Foreign keys

Always explicit `@relation` with FK name :

```prisma
booking      Booking   @relation(fields: [bookingId], references: [id])
bookingId    String
```

Reverse side on the parent :
```prisma
events       BookingFinanceEvent[]
```

### Indexes

Add when :
- Filtering on the column (`where: { status: ... }`)
- Sorting on the column (`orderBy: { createdAt: ... }`)
- Joining via the column

Use `@@index([field])` in the model block. Multi-column for compound filters :

```prisma
@@index([sitterId, serviceType])
```

Don't over-index — every index slows writes. Re-evaluate when query latency drops.

## Enums

Add values by `ALTER TYPE … ADD VALUE`. **Never reorder or remove values** — that's a destructive migration on prod data.

If a value is deprecated, leave it. Add a comment in `schema.prisma` saying so.

## Money

**Always `Int` centimes for money fields.** Never `Float`, never `Decimal` (Prisma's Decimal is too slow for our use case).

```prisma
amount             Int
platformFeeAmount  Int
sitterPayoutAmount Int?
```

Multiply CHF×100 on write, divide by 100 for display. `Math.round()` is safe.

## JSON columns

Use sparingly — they're untyped at the DB level. OK for :
- Form data snapshots (PilotSitterApplication.availabilityStructured)
- External payloads (Stripe events, Cal.com webhooks)
- AgentLog.details

Never for queryable fields. If you need to query inside JSON, that's a sign the data should be flattened into columns.

## The User-not-SitterProfile gotcha

`AvailabilityRule`, `AvailabilityException`, `ServiceConfig` are all on `User` (via `User.sitterId`), NOT on `SitterProfile`. This is intentional — availability is tied to a user identity, not the sitter profile entity (which could be deleted/recreated).

**Never `prisma as any` to bypass type errors.** That hid the relation bug in PR #336. See `docs/bugs/prisma-availability-rule-relation.md`.

## Cascading deletes

Be EXPLICIT :
```prisma
sitterProfile  SitterProfile?  @relation(fields: [sitterId], references: [sitterId], onDelete: SetNull)
```

Default is `NoAction`. Mistakenly setting `Cascade` can wipe whole subgraphs. Bookings and AuditLog should NEVER cascade-delete.

## Verifying after deploy

Once a schema-changing PR ships :

1. Wait ~3 min for Vercel deploy
2. Trigger the migration status cron :
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" "https://www.dogshift.ch/api/cron/prisma-migration-status"
   ```
3. Response `pending: []` means clean. If non-empty, see `migration-prisma` skill for manual recovery.

## What NOT to do

- ❌ `npx prisma migrate dev` — would reset the shared Neon branch
- ❌ `prisma migrate reset` — see above, x100
- ❌ Edit a previous migration file after it's been applied — checksums break
- ❌ Rename a migration folder to "retry" — confuses `_prisma_migrations` further
- ❌ `prisma as any` to silence type errors — hides relation bugs
- ❌ Floats for money
- ❌ Cascade delete on Booking, AuditLog, BookingFinanceEvent
- ❌ Use the SitterProfile model for any availability data — User is the parent

## Where to look

- `prisma/schema.prisma` — single source of truth
- `prisma/migrations/` — history (timestamp-ordered)
- `docs/data-models.md` — model docs with French glossary
- `docs/bugs/prisma-migration-not-applied-on-prod.md` — what to do when prod misses a migration
- `docs/bugs/prisma-availability-rule-relation.md` — the User-not-SitterProfile bug
- `/api/cron/prisma-migration-status` — daily drift detector
