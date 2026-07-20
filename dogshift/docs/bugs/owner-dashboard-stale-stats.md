# Owner dashboard shows incoherent stats (fake next reservation, phantom unread)

## Symptom
On the native owner dashboard (`/account`), the founder saw:
- **"Prochaine réservation"** showing a reservation that isn't real (e.g. `Promenade · jeu. 23 juil., 04:30 · Céline`) — actually an **unpaid** abandoned Stripe checkout.
- **"1 Messages"** (badge on the Messages tile) while there was **no** unread message to read.

## Root cause
`app/(marketing)/account/page.tsx` computes the dashboard stats in one `Promise.all`:
- **nextBooking** query included `PENDING_PAYMENT` and `DRAFT` in the status `in` list, so an unpaid draft / abandoned checkout was surfaced as the "prochaine réservation".
- **unreadMessages** query filtered `conversation: { ownerId }` only — **not** `deletedAt: null`. A conversation the owner swipe-deleted (soft-delete `Conversation.deletedAt`) kept its unread messages counted in the badge.

## Fix (PR TBD, 2026-07-19)
- `nextBooking` status restricted to real reservations via `DASHBOARD_UPCOMING_BOOKING_STATUSES` (`CONFIRMED`, `PENDING_ACCEPTANCE`, `PAID`) in `lib/account/dashboardStats.ts`. Unpaid `PENDING_PAYMENT`/`DRAFT` never show as upcoming.
- `unreadMessages` now filters `conversation: { ownerId: uid, deletedAt: null }` — matches the conversation list source of truth, so deleted conversations no longer inflate the badge.
- Regression test: `tests/integrations/ownerDashboardStats.test.ts`.

## What NOT to do
- Don't re-add `PENDING_PAYMENT`/`DRAFT` to the "prochaine réservation" query — those belong to "réservations à payer", not the upcoming card.
- Deleted bookings are already excluded from the dashboard counts via `archivedAt: null` (you can only delete an archived booking), so no `Booking.deletedAt` filter is needed here.

## 🤖 Automated detection
```json
{ "type": "none", "reason": "Auth-gated server component; both bugs are query-filter fixes verified by tests/integrations/ownerDashboardStats.test.ts + the deletedAt filter. No standalone HTTP/SQL probe reproduces a user-specific stat without a seeded owner." }
```
