---
name: availability-engine
description: Work with DogShift's slot computation engine — recurring availability rules, date-specific exceptions, capacity constraints across the 3 service types (Promenade, Dogsitting, Pension). Use when touching lib/availability/, slot debug, "sitter shows unavailable", or modifying service config.
---

# Availability engine — DogShift slot computation

## What it computes

Given a sitter + a service type + a date range, the engine returns available time slots — accounting for :
- Sitter's weekly `AvailabilityRule`s
- Date-specific `AvailabilityException`s (overrides)
- Existing `Booking`s already on the calendar
- Per-service `ServiceConfig` constraints (durations, buffers, lead times, check-in/out windows)
- Weighted dog capacity (multi-dog bookings)
- Last-minute toggle

**No pre-computed slots.** Everything resolved at query time. That's why a sitter can change their availability and it reflects instantly.

## Three service types — different rules

| Service | Granularity | Constraint key |
|---|---|---|
| **Promenade** | Hourly, intra-day | `slotStepMin`, `minDurationMin`, `maxDurationMin`, `bufferBeforeMin`, `bufferAfterMin` |
| **Dogsitting** (Garde) | Hourly, intra-day | Same as Promenade |
| **Pension** (Boarding) | Multi-day | `overnightRequired: true`, `checkInStartMin`/`checkInEndMin`, `checkOutStartMin`/`checkOutEndMin` |

`ServiceConfig` is per-sitter-per-service (PK = `sitterId + serviceType`). Defaults are in `/api/sitters/me/availability-init`.

## Critical Prisma gotcha

**`AvailabilityRule` is on `User`, NOT `SitterProfile`.** The FK goes through `User.sitterId`. To count rules for a sitter :

```ts
// ❌ WRONG
prisma.sitterProfile.findMany({
  include: { _count: { select: { availabilityRules: true } } },
});

// ✅ RIGHT — go through the user relation
prisma.sitterProfile.findMany({
  include: {
    user: {
      select: { _count: { select: { availabilityRules: true } } },
    },
  },
});
```

PR #336 bug. Documented in `docs/bugs/prisma-availability-rule-relation.md`.

## Status enum

`AvailabilityStatus` = `AVAILABLE | ON_REQUEST | UNAVAILABLE`

- `AVAILABLE` — bookable immediately
- `ON_REQUEST` — needs sitter confirmation (creates booking in `PENDING_ACCEPTANCE`)
- `UNAVAILABLE` — not bookable

The default if no rule covers a time window is `UNAVAILABLE`. Sitters opt in, not out.

## Day-level vs slot-level APIs

| Endpoint | Granularity | Use case |
|---|---|---|
| `/api/sitters/[id]/day-status` | Day | Calendar picker "this day is green/yellow/red" |
| `/api/sitters/[id]/day-status/multi` | Day (batched) | Month view, multi-day picker |
| `/api/sitters/[id]/boarding-status` | Date range | Pension multi-day check |
| `/api/sitters/[id]/day-details` | Slots within a day | Hourly picker after a day is selected |
| `/api/sitters/[id]/slots` | Slots | Same as day-details, legacy |
| `/api/sitters/[id]/availability` | Range of days | Calendar overview |

Day-level computes a single "best status" per day. Slot-level expands the hourly windows.

## How a booking interacts

When a booking is created (or expires / cancels), the engine re-computes the affected dates. No cache invalidation — fresh query every time.

Pending bookings (`PENDING_PAYMENT`, `PENDING_ACCEPTANCE`) still block the slot — otherwise concurrent bookings could double-book. They unblock when expired (cron `/api/cron/expire-pending-bookings`) or cancelled.

## Weighted capacity model

Sitters declare max dogs per service. The engine sums concurrent bookings' dog count against this cap. Multi-dog bookings count proportionally (a "weighted" 0.7 cocker + 1.2 dane > 1.0 dane alone).

See `lib/availability/capacity*.ts` for the math. Tests in `tests/capacity/`.

## Audit log

Every change to rules / exceptions is logged via `lib/availability/auditLog.ts`. Read at `/api/sitters/me/audit`. Useful when a sitter says "I never made this rule" — track who changed what.

## When debugging "sitter shows unavailable" / "shows wrong slots"

Checklist :

1. **Rules** : does the sitter have `AvailabilityRule`s for this service type + day of week ?
2. **Exceptions** : is there an `AvailabilityException` overriding for this specific date ?
3. **Bookings** : any conflicting `Booking` (status != cancelled/refunded) in the time window ?
4. **ServiceConfig** : are the buffers / lead times pushing the slot out ?
5. **Capacity** : is the sitter at max dogs ?
6. **`AvailabilityException` precedence** : exceptions ALWAYS win over rules, even if marked UNAVAILABLE for that date

Recipe :

```bash
npx tsx --env-file=.env.local -e "
import { prisma } from './lib/prisma';
import { computeDayStatus } from './lib/availability/dayStatus';

const sitterId = '<sitterId>';
const date = new Date('2026-05-19');
const r = await computeDayStatus({ sitterId, serviceType: 'PROMENADE', date });
console.log(JSON.stringify(r, null, 2));
await prisma.\$disconnect();
"
```

## Tests

Live in `tests/availability/`. Cover recurring rules, exceptions, bookings overlap, buffer math, multi-day Pension, capacity edge cases. ~80+ test cases — the engine has been bitten enough that we lock everything.

Every availability bug fix MUST add a test case.

## What NOT to do

- ❌ Pre-compute slots into a "schedule" table — defeats the live recomputation property
- ❌ Cache the response with anything other than a per-request lifetime — sitters edit rules and expect instant reflection
- ❌ `prisma as any` to skip the User-not-SitterProfile relation — PR #336 already burned us
- ❌ Allow a Pension booking < 1 night (overnight required by service definition)
- ❌ Ignore `ServiceConfig` buffers — they're load-bearing (sitter physical movement between gardes)
- ❌ Hardcode UTC timezone — DogShift is Europe/Zurich for all user-facing dates

## Where to look

- `lib/availability/slotEngine.ts` — core slot computation
- `lib/availability/dayStatus.ts` + `dayStatusMulti.ts` — day-level wrappers
- `lib/availability/capacity*.ts` — weighted dog capacity math
- `lib/availability/reasonBuckets.ts` — why a slot is unavailable (for UI debug)
- `tests/availability/` — 80+ test cases for reference
- `docs/bugs/prisma-availability-rule-relation.md` — the User-not-SitterProfile bug
