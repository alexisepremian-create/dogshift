# Owner dashboard "X réservations à payer" leads to an empty list

## Symptom
On the native owner dashboard the founder saw **"12 réservations à payer"**, but
tapping it opened the Réservations tab with **nothing** shown ("Aucune réservation
en attente de paiement."). He assumed they were archived.

## Root cause
Two independent problems made the badge and the list disagree:

1. **The view could never show them.** `rows` in `app/(marketing)/account/bookings/page.tsx`
   did `matchesTab(b, "PENDING")` (which only allows `PENDING_ACCEPTANCE`/`PAID`)
   **then** `matchesPendingSubfilter(status, "payment")` (which requires
   `PENDING_PAYMENT`/`DRAFT`). Those sets are mutually exclusive → the "à payer"
   view was **always empty by construction**.

2. **The count included abandoned checkouts.** The dashboard counted every
   non-archived `PENDING_PAYMENT`/`DRAFT`. Prod for `luigi111.ytbr@gmail.com`: 12
   `PENDING_PAYMENT`, non-archived, all old — abandoned Stripe checkouts whose
   sessions had long expired. They can't be paid, so nudging "12 à payer" is a
   dead-end. (The `expire-pending-bookings` cron only handles
   `PENDING_ACCEPTANCE`/`PAID`, never `PENDING_PAYMENT`, so these accumulate.)

## Fix (2026-07-21)
Single source of truth `lib/bookings/pendingPayment.ts`:
`isPendingPaymentResumable(createdAt)` = the unpaid checkout is < 48h old (still
resumable). Used by BOTH:
- Dashboard count (`app/(marketing)/account/page.tsx`): counts only non-archived
  `PENDING_PAYMENT` with `createdAt >= now-48h` (DRAFT dropped — the bookings API
  never returns it).
- Bookings view (`app/(marketing)/account/bookings/page.tsx`): the PENDING tab's
  "payment" filter shows non-archived resumable `PENDING_PAYMENT`/`DRAFT`.

Now the badge and the list always agree. Abandoned checkouts (>48h) are not
surfaced. Regression test: `tests/bookings/pendingPayment.test.ts`.

## What NOT to do
- Don't re-add the `matchesTab(PENDING)` ∩ `payment-subfilter` double filter — it's
  empty by construction.
- Don't count `DRAFT` in "à payer" on the dashboard — `app/api/account/bookings`
  filters `status: { notIn: ["DRAFT"] }`, so a DRAFT could never appear in the list.
- Don't "fix" it by widening the window arbitrarily; 48h matches the dashboard's
  existing stale-payment threshold.

## Follow-up (not done here)
Abandoned `PENDING_PAYMENT` bookings are never cleaned up. A cron marking
`PENDING_PAYMENT` older than the checkout window as `CANCELLED` (safe — no payment
succeeded, nothing to refund) would keep the DB tidy.

## 🤖 Automated detection
```json
{ "type": "none", "reason": "Auth-gated per-user dashboard vs list coherence; verified by tests/bookings/pendingPayment.test.ts. No standalone HTTP/SQL probe reproduces a user-specific badge/list mismatch without a seeded owner + timed PENDING_PAYMENT rows." }
```
