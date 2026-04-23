import test from "node:test";
import assert from "node:assert/strict";

import {
  APPLICATION_DECISION_VALUES,
  applicationDecisionToStatus,
  isApplicationDecision,
} from "../../lib/sitterApplication/decisionStatus.ts";

test("applicationDecisionToStatus: HIGH maps to ACCEPTED", () => {
  assert.equal(applicationDecisionToStatus("HIGH"), "ACCEPTED");
});

test("applicationDecisionToStatus: REVIEW maps to CONTACTED", () => {
  assert.equal(applicationDecisionToStatus("REVIEW"), "CONTACTED");
});

test("applicationDecisionToStatus: LOW maps to REJECTED", () => {
  assert.equal(applicationDecisionToStatus("LOW"), "REJECTED");
});

test("APPLICATION_DECISION_VALUES exposes the 3 canonical decisions", () => {
  // Prevents accidental additions/removals from silently breaking the n8n
  // contract — if someone adds a 4th decision they must update this test too.
  assert.deepEqual([...APPLICATION_DECISION_VALUES].sort(), ["HIGH", "LOW", "REVIEW"]);
});

test("isApplicationDecision: accepts known values, rejects unknown", () => {
  assert.equal(isApplicationDecision("HIGH"), true);
  assert.equal(isApplicationDecision("REVIEW"), true);
  assert.equal(isApplicationDecision("LOW"), true);
  assert.equal(isApplicationDecision("PENDING"), false);
  assert.equal(isApplicationDecision(""), false);
  assert.equal(isApplicationDecision(null), false);
  assert.equal(isApplicationDecision(undefined), false);
  assert.equal(isApplicationDecision(123), false);
});
