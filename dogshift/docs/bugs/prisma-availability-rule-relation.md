# AvailabilityRule relation is on User, not SitterProfile

**Status:** Fixed (PR #336, 2026-05-18)

## Symptom

Cron `/api/cron/inactivity-check` threw `PrismaClientValidationError` at
runtime even though `tsc --noEmit` passed cleanly. The error was caused
by querying `_count: { availabilityRules }` directly on `SitterProfile`
in a `prisma.sitterProfile.findMany()` call.

## Root cause

In the Prisma schema, `AvailabilityRule` has a foreign key to `User`
(via `User.sitterId`), NOT to `SitterProfile`. So:

```ts
// WRONG — AvailabilityRule is not a SitterProfile relation
prisma.sitterProfile.findMany({
  include: { _count: { select: { availabilityRules: true } } },
});

// CORRECT — go through the user relation
prisma.sitterProfile.findMany({
  include: {
    user: {
      select: { _count: { select: { availabilityRules: true } } },
    },
  },
});
```

The `prisma as any` cast in the cron route hid this from the type
checker — typescript silenced the only signal that could have caught it.

## Fix

Use the `user` relation as the bridge:

```ts
const sitters = await prisma.sitterProfile.findMany({
  where: { ... },
  include: {
    user: {
      select: {
        _count: { select: { availabilityRules: true } },
      },
    },
  },
});
```

Then read the count via `s.user._count.availabilityRules`.

## How to recognize a regression

- `PrismaClientValidationError: Unknown field 'availabilityRules' in
  select on SitterProfile`
- Cron runs fine in dev but fails on first prod execution

## What NOT to do

- Do NOT `prisma as any` to suppress Prisma's own type checks in NEW code.
  It's tolerated in legacy files (the cron uses it for unrelated reasons)
  but should not spread.
- Do NOT add `AvailabilityRule` directly on `SitterProfile` in schema.prisma
  "to fix" this. The User-level relation is intentional — availability is
  tied to a user identity, not the sitter profile entity.

## Related PRs

- PR #336 — fix the cron query

## 🤖 Automated detection

```json
{
  "type": "sql",
  "query": "SELECT COUNT(*)::int AS value FROM \"SitterProfile\" sp WHERE sp.\"lifecycleStatus\" = 'activated' AND NOT EXISTS (SELECT 1 FROM \"User\" u WHERE u.\"sitterId\" = sp.\"sitterId\")",
  "expect_max": 0,
  "auto_fix": { "complexity": "complex" }
}
```

Counts activated `SitterProfile` rows whose `sitterId` doesn't resolve to a
`User.sitterId`. This is the schema invariant the bug violated. If it's > 0,
something has decoupled the relation (a missing migration, a backfill bug,
etc.). Auto-fix **complex** — needs a human to investigate where the orphan
came from before patching.
