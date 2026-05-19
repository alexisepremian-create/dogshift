# Monitoring: Stripe payout reconciliation

**Status:** Implemented (`/api/cron/reconcile-payouts`). Not a bug — a
risk that needs ongoing monitoring.

## Risk

The release cron (`release-booking-payouts`) can mark a payout as `PAID`
in the DB while the Stripe Transfer actually fails. The reconciliation
cron (`reconcile-payouts`) detects these divergences and re-tries / flags.

## Actions

- [ ] Monitor Sentry alerts tagged
  `error_kind: "payout_reconciliation_mismatch"`
- [ ] Spot-check `BookingFinanceEvent` rows for anomalies in monthly recap

## How a regression would look

- Sitter complains about a payout they should have received
- DB shows `payoutStatus: PAID` but Stripe shows no transfer
- Or: Stripe shows transfer but DB ledger doesn't reflect it

## 🤖 Automated detection

```json
{
  "type": "none",
  "reason": "Nécessite une réconciliation contre l'API Stripe live — trop coûteux pour un probe nocturne. Couvert par le cron dédié /api/cron/reconcile-payouts + les alertes Sentry tagguées error_kind=payout_reconciliation_mismatch."
}
```
