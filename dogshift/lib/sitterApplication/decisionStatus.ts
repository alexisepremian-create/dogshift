/**
 * Maps the n8n scoring decision (HIGH / REVIEW / LOW) to the internal
 * pilot sitter application status.
 *
 * Why this lives in its own module:
 *  - Reused by both the HTTP endpoint that n8n calls and any future server-side
 *    batch re-scoring script.
 *  - Keeps the mapping a single source of truth so the admin UI copy and the
 *    n8n workflow stay in sync when we ever tweak the rules.
 *
 * Mapping rationale:
 *  - HIGH   → ACCEPTED  : candidate passed auto-scoring, we move them to the
 *                         "Accepté" bucket so the contract button unlocks in
 *                         the admin panel.
 *  - REVIEW → CONTACTED : candidate needs a human look; marked as "Contacté"
 *                         so admin can follow up without bumping them to
 *                         Accepté prematurely.
 *  - LOW    → REJECTED  : candidate gets the polite rejection email already;
 *                         status must match what the candidate was told.
 */

export const APPLICATION_DECISION_VALUES = ["HIGH", "REVIEW", "LOW"] as const;

export type ApplicationDecision = (typeof APPLICATION_DECISION_VALUES)[number];

export type PilotSitterApplicationStatus =
  | "PENDING"
  | "CONTACTED"
  | "ACCEPTED"
  | "ACTIVATED"
  | "REJECTED";

const DECISION_TO_STATUS: Record<ApplicationDecision, PilotSitterApplicationStatus> = {
  HIGH: "ACCEPTED",
  REVIEW: "CONTACTED",
  LOW: "REJECTED",
};

export function applicationDecisionToStatus(
  decision: ApplicationDecision,
): PilotSitterApplicationStatus {
  return DECISION_TO_STATUS[decision];
}

export function isApplicationDecision(value: unknown): value is ApplicationDecision {
  return typeof value === "string" && (APPLICATION_DECISION_VALUES as readonly string[]).includes(value);
}
