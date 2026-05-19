---
name: stripe-payout
description: Debug or modify DogShift's Stripe Connect payout flow — release-booking-payouts cron, reconcile-payouts, BookingFinanceEvent ledger, source_transaction. Use when a sitter complains "j'ai pas reçu mon virement", when payoutStatus is stuck, or when touching anything in lib/stripe/.
---

# Stripe Connect payouts — DogShift

## Money invariants (NEVER violate)

- **All monetary amounts in DB are `Int` centimes.** Never float. `Math.round()` is safe. Multiply CHF×100 on write, divide by 100 only for display.
- **Platform fee = 10 %** (sitter gets 90 %). Defined in `lib/stripe/bookingPayments.ts` — change there, not at call sites.
- **Stripe transfers MUST include `source_transaction: chargeId`** — without it the transfer pulls from the platform's pooled balance instead of the booking's charge → insufficient-funds errors + broken Connect audit trail.

## Flow recap

```
1. Owner pays  →  charge.succeeded  →  Booking.status = PAID
                                      Booking.stripeChargeId set
                                      Booking.payoutStatus = PENDING

2. Service ends (T+24h)  →  /api/cron/release-booking-payouts
                            stripe.transfers.create({
                              amount: sitterPayoutAmount,
                              currency: 'chf',
                              destination: sitter.stripeAccountId,
                              source_transaction: stripeChargeId,  // ← critical
                            })
                            Booking.payoutStatus = PAID
                            Booking.stripeTransferId set

3. Daily 06h UTC  →  /api/cron/reconcile-payouts
                     For each PAID booking, verify Stripe Transfer
                     exists. If not → flag (DB says PAID, Stripe says
                     no) → alert maintenance bot
```

## Debugging "sitter says no payout"

### 1. Check the booking in DB

```bash
npx tsx --env-file=.env.local -e "
import { prisma } from './lib/prisma';
const b = await prisma.booking.findUnique({
  where: { id: '<bookingId>' },
  select: { id: true, status: true, payoutStatus: true, sitterPayoutAmount: true,
    stripeChargeId: true, stripeTransferId: true, payoutReleasedAt: true, endAt: true }
});
console.log(b);
await prisma.\$disconnect();
"
```

Possible states:
- `status: PAID, payoutStatus: PENDING, endAt > now()` → normal, T+24h not reached
- `status: PAID, payoutStatus: PENDING, endAt < now()-24h` → cron missed it; check `/api/cron/release-booking-payouts` AgentLog
- `payoutStatus: PAID, stripeTransferId: null` → corrupted state; manual fix needed
- `payoutStatus: PAID, stripeTransferId: 'tr_…'` → DB says good; verify on Stripe side

### 2. Cross-check Stripe

Open Stripe Dashboard → Connect → Transfers, search by `stripeTransferId`. If missing, the cron lied to the DB.

### 3. Check BookingFinanceEvent ledger

Every charge / transfer / refund creates a `BookingFinanceEvent` row with `actorType` (SYSTEM / ADMIN / STRIPE). It's the audit trail :

```ts
const events = await prisma.bookingFinanceEvent.findMany({
  where: { bookingId: '<id>' },
  orderBy: { createdAt: 'asc' },
});
```

If a transfer event is missing, the transfer was never recorded → check cron logs around the booking's `endAt + 24h`.

## Webhooks handled

`/api/webhooks/stripe` handles ONLY these events (others ignored on purpose) :
- `charge.succeeded` → mark booking PAID, send confirmation email
- `charge.refunded` → mark booking REFUNDED
- `payment_intent.payment_failed` → mark PAYMENT_FAILED, retry email
- `checkout.session.completed` → flip session to confirmed

Don't bolt on new events without a clear flow.

## Stripe Connect onboarding state

`SitterProfile.stripeAccountStatus` is a string :
- `null` / `'pending'` → no account yet
- `'incomplete'` → account created but onboarding not done
- `'restricted'` → Stripe needs more info
- `'enabled'` → ready to receive payouts ; `published` requires this

If `published: true` but `stripeAccountStatus != 'enabled'` → bug. Should be impossible per validation.

## What NOT to do

- ❌ Issue a transfer **without** `source_transaction` → breaks audit + insufficient funds errors
- ❌ Store amounts as floats anywhere
- ❌ Bypass `BookingFinanceEvent` ledger for manual refunds — always record
- ❌ Run `stripe.transfers.create()` in a user-facing route (always cron / webhook)
- ❌ Trust DB `payoutStatus` without cross-checking Stripe — that was the May 2026 reconciliation bug

## Manual payout (admin tool)

`POST /api/admin/bookings/[id]/payout` is the only safe way to manually trigger a transfer. It :
1. Re-validates `payoutStatus = PENDING`
2. Re-checks `stripeChargeId` exists
3. Calls `stripe.transfers.create(...)` with `source_transaction`
4. Updates DB + writes `BookingFinanceEvent { actorType: 'ADMIN' }`

Never call `stripe.transfers.create()` directly from a script — go through this route to keep the audit trail clean.

## Currency

`'chf'` everywhere. Not `'CHF'` (Stripe rejects uppercase). Not `'eur'` (Swiss only).

## Where to look

- `lib/stripe/bookingPayments.ts` — fee math + amount calculation
- `app/api/cron/release-booking-payouts/route.ts` — transfer issue logic
- `app/api/cron/reconcile-payouts/route.ts` — drift detection
- `app/api/webhooks/stripe/route.ts` — event handlers
- `docs/bugs/monitoring-stripe-payout-reconciliation.md` — incident playbook
