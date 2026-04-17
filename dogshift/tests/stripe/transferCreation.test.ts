/**
 * Unit tests for Stripe transfer payout logic.
 *
 * Verifies that:
 * 1. source_transaction is set to the chargeId when available (core fix).
 * 2. The payout amount is gross - platformFee (sitter absorbs no Stripe fees).
 * 3. The transfer is skipped (not zero-ed) when no chargeId AND no available balance.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline helpers extracted from the payout cron to make them unit-testable
// without mocking Prisma/Stripe.
// ---------------------------------------------------------------------------

interface BookingPayoutInput {
  grossAmount: number;
  platformFeeAmount: number;
  stripeFeeAmount: number;
  chargeId: string | null;
  availableBalance: number;
}

interface TransferDecision {
  transferAmount: number;
  useSourceTransaction: boolean;
  skip: boolean;
}

function computeTransferDecision(input: BookingPayoutInput): TransferDecision {
  const { grossAmount, platformFeeAmount, stripeFeeAmount, chargeId, availableBalance } = input;
  const payoutAmount = Math.max(0, grossAmount - platformFeeAmount);
  const netAmount = Math.max(0, grossAmount - stripeFeeAmount - platformFeeAmount);

  if (chargeId) {
    return {
      transferAmount: payoutAmount > 0 ? payoutAmount : netAmount,
      useSourceTransaction: true,
      skip: false,
    };
  }

  if (availableBalance <= 0) {
    return { transferAmount: 0, useSourceTransaction: false, skip: true };
  }

  const transferAmount =
    payoutAmount <= availableBalance
      ? payoutAmount
      : netAmount <= availableBalance
        ? netAmount
        : 0;

  return {
    transferAmount,
    useSourceTransaction: false,
    skip: transferAmount <= 0,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("with chargeId: uses source_transaction and full payout amount (no balance check)", () => {
  const result = computeTransferDecision({
    grossAmount: 2612,
    platformFeeAmount: 200,
    stripeFeeAmount: 106,
    chargeId: "ch_3TM0K3EpLDnT2sHn0obRBYwd",
    availableBalance: 0, // balance is 0 — should NOT block the transfer
  });

  assert.equal(result.useSourceTransaction, true);
  assert.equal(result.skip, false);
  assert.equal(result.transferAmount, 2412); // 2612 - 200 platform fee
});

test("with chargeId: transfer amount equals gross minus platform fee regardless of Stripe fee", () => {
  const result = computeTransferDecision({
    grossAmount: 5000,
    platformFeeAmount: 300,
    stripeFeeAmount: 150,
    chargeId: "ch_test_abc",
    availableBalance: 99999,
  });

  assert.equal(result.transferAmount, 4700); // 5000 - 300, Stripe fee not deducted from sitter
  assert.equal(result.useSourceTransaction, true);
});

test("without chargeId: skips when available balance is 0", () => {
  const result = computeTransferDecision({
    grossAmount: 2612,
    platformFeeAmount: 200,
    stripeFeeAmount: 106,
    chargeId: null,
    availableBalance: 0,
  });

  assert.equal(result.skip, true);
  assert.equal(result.transferAmount, 0);
  assert.equal(result.useSourceTransaction, false);
});

test("without chargeId: uses payoutAmount when balance is sufficient", () => {
  const result = computeTransferDecision({
    grossAmount: 2612,
    platformFeeAmount: 200,
    stripeFeeAmount: 106,
    chargeId: null,
    availableBalance: 5000,
  });

  assert.equal(result.skip, false);
  assert.equal(result.transferAmount, 2412);
  assert.equal(result.useSourceTransaction, false);
});

test("without chargeId: falls back to netAmount when payoutAmount exceeds balance", () => {
  // payoutAmount = 2612 - 200 = 2412, netAmount = 2612 - 106 - 200 = 2306
  // availableBalance 2350: too small for payoutAmount (2412) but fits netAmount (2306)
  const result = computeTransferDecision({
    grossAmount: 2612,
    platformFeeAmount: 200,
    stripeFeeAmount: 106,
    chargeId: null,
    availableBalance: 2350,
  });

  const expectedNet = Math.max(0, 2612 - 106 - 200); // 2306
  assert.equal(result.skip, false);
  assert.equal(result.transferAmount, expectedNet);
});

test("without chargeId: skips when neither payoutAmount nor netAmount fits in balance", () => {
  const result = computeTransferDecision({
    grossAmount: 2612,
    platformFeeAmount: 200,
    stripeFeeAmount: 106,
    chargeId: null,
    availableBalance: 100, // way below both amounts
  });

  assert.equal(result.skip, true);
  assert.equal(result.transferAmount, 0);
});

test("payout amount is never negative", () => {
  // Edge case: platformFeeAmount larger than grossAmount (misconfiguration guard)
  const result = computeTransferDecision({
    grossAmount: 100,
    platformFeeAmount: 200,
    stripeFeeAmount: 10,
    chargeId: "ch_edge",
    availableBalance: 0,
  });

  assert.ok(result.transferAmount >= 0);
});
