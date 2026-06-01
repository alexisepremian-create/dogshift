import { test } from "node:test";
import assert from "node:assert/strict";

import { CURRENT_TERMS_VERSION } from "../../lib/terms.ts";
import {
  planAutoFix,
  runProfileHealthChecks,
  type ProfileSnapshot,
} from "../../lib/agents/profileHealthInvariants.ts";

// Each check has a happy-path fixture (passes) and a failing fixture (fires).
// If a future refactor changes the semantics of a check, this file rings the
// alarm — these invariants are what protect users from "soft" data drifts
// (Sonia's CGU-missing-but-published case being the most painful instance).

function baseSnap(overrides: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  // Note : profileCompletion is null so COMPLETION_CACHE_STALE never fires on
  // the happy path (the cron only flags drift when a cached value exists and
  // differs from the recomputation — we don't fabricate a value here just to
  // re-assert what computeSitterProfileCompletionDetails does).
  return {
    user: {
      id: "usr_1",
      email: "user@example.com",
      name: "Sonia",
      role: "SITTER",
      sitterId: "stt_1",
      // Mirror the SitterProfile shape so SERVICES_DESYNC + DOG_SIZES_DESYNC
      // are silent on the happy path.
      hostProfileJson: {
        services: { Promenade: true, Garde: false, Pension: false },
        dogSizes: { Small: true, Medium: false, Large: false },
      },
      ...(overrides.user ?? {}),
    },
    sitterProfile: overrides.sitterProfile === null
      ? null
      : {
          id: "sp_1",
          sitterId: "stt_1",
          published: true,
          lifecycleStatus: "activated",
          verificationStatus: "approved",
          stripeAccountStatus: "ENABLED",
          termsAcceptedAt: new Date("2026-01-15T10:00:00Z"),
          termsVersion: CURRENT_TERMS_VERSION,
          services: ["Promenade"],
          dogSizes: ["Small"],
          pricing: { Promenade: 30 },
          avatarUrl: "https://example.com/a.jpg",
          profileCompletion: null,
          city: "Lausanne",
          displayName: "Sonia B.",
          bio: "Lorem ipsum.",
          ...(overrides.sitterProfile ?? {}),
        },
  };
}

test("happy path produces no issues", () => {
  const issues = runProfileHealthChecks(baseSnap());
  assert.deepEqual(issues, [], `should be clean but got: ${JSON.stringify(issues)}`);
});

test("TERMS_MISSING_BUT_PUBLISHED fires for Sonia-style profile", () => {
  const snap = baseSnap({
    sitterProfile: { termsAcceptedAt: null, termsVersion: null, published: true } as never,
  });
  const issues = runProfileHealthChecks(snap);
  const ids = issues.map((i) => i.id);
  assert.ok(ids.includes("TERMS_MISSING_BUT_PUBLISHED"), `got: ${ids.join(",")}`);
});

test("TERMS_OUTDATED fires when version diverges", () => {
  const snap = baseSnap({
    sitterProfile: {
      published: false,
      termsAcceptedAt: new Date("2025-08-01T00:00:00Z"),
      termsVersion: "2025-08-old",
    } as never,
  });
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("TERMS_OUTDATED"));
});

test("STRIPE_NOT_ENABLED_BUT_PUBLISHED fires when account is not ENABLED", () => {
  const snap = baseSnap({
    sitterProfile: { stripeAccountStatus: "DEFERRED", published: true } as never,
  });
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("STRIPE_NOT_ENABLED_BUT_PUBLISHED"));
});

test("LIFECYCLE_MISMATCH_PUBLISHED fires when published but lifecycle != activated", () => {
  const snap = baseSnap({
    sitterProfile: { lifecycleStatus: "contract_signed", published: true } as never,
  });
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("LIFECYCLE_MISMATCH_PUBLISHED"));
});

test("VERIFICATION_NOT_APPROVED_PUBLISHED fires when published but pending", () => {
  const snap = baseSnap({
    sitterProfile: { verificationStatus: "pending", published: true } as never,
  });
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("VERIFICATION_NOT_APPROVED_PUBLISHED"));
});

test("SERVICES_DESYNC fires when hostProfileJson and SitterProfile diverge", () => {
  const snap = baseSnap({
    user: {
      id: "usr_1",
      email: "u@e.com",
      name: null,
      role: "SITTER",
      sitterId: "stt_1",
      // hostProfileJson says Garde=true, SitterProfile.services says ["Promenade"]
      hostProfileJson: { services: { Promenade: false, Garde: true, Pension: false } },
    },
    sitterProfile: { services: ["Promenade"] } as never,
  });
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("SERVICES_DESYNC"));
});

test("DOG_SIZES_DESYNC fires when shapes diverge", () => {
  const snap = baseSnap({
    user: {
      id: "usr_1",
      email: "u@e.com",
      name: null,
      role: "SITTER",
      sitterId: "stt_1",
      hostProfileJson: { dogSizes: { Small: true, Medium: false, Large: false } },
    },
    sitterProfile: { dogSizes: ["Small", "Medium"] } as never,
  });
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("DOG_SIZES_DESYNC"));
});

test("SITTER_PROFILE_ORPHAN fires when user.sitterId points to nothing", () => {
  const snap: ProfileSnapshot = {
    user: { id: "u", email: "u@e.com", name: null, role: "SITTER", sitterId: "stt_missing", hostProfileJson: null },
    sitterProfile: null,
  };
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("SITTER_PROFILE_ORPHAN"));
});

test("EMAIL_MISSING fires when User.email is null/empty", () => {
  const snap = baseSnap({
    user: { id: "u", email: null, name: null, role: "OWNER", sitterId: null, hostProfileJson: null },
    sitterProfile: null,
  });
  const ids = runProfileHealthChecks(snap).map((i) => i.id);
  assert.ok(ids.includes("EMAIL_MISSING"));
});

test("planAutoFix returns a Prisma plan for SERVICES_DESYNC", () => {
  const snap = baseSnap({
    user: {
      id: "usr_1",
      email: "u@e.com",
      name: null,
      role: "SITTER",
      sitterId: "stt_1",
      hostProfileJson: { services: { Promenade: false, Garde: true, Pension: false } },
    },
    sitterProfile: { services: ["Promenade"] } as never,
  });
  const issues = runProfileHealthChecks(snap);
  const issue = issues.find((i) => i.id === "SERVICES_DESYNC");
  assert.ok(issue);
  const plan = planAutoFix(issue, snap);
  assert.ok(plan);
  assert.equal(plan.table, "user");
  assert.equal(plan.where.id, "usr_1");
  const services = (plan.data as { hostProfileJson?: { services?: Record<string, boolean> } }).hostProfileJson?.services;
  assert.deepEqual(services, { Promenade: true, Garde: false, Pension: false });
});

test("planAutoFix returns null for non-fixable invariants", () => {
  const snap = baseSnap({
    sitterProfile: { termsAcceptedAt: null, termsVersion: null, published: true } as never,
  });
  const issue = runProfileHealthChecks(snap).find((i) => i.id === "TERMS_MISSING_BUT_PUBLISHED");
  assert.ok(issue);
  assert.equal(planAutoFix(issue, snap), null);
});

test("severity order locked: TERMS_MISSING_BUT_PUBLISHED is high (sorts before medium)", () => {
  const snap = baseSnap({
    sitterProfile: {
      termsAcceptedAt: null,
      termsVersion: null,
      published: true,
      stripeAccountStatus: "ENABLED",
      lifecycleStatus: "activated",
      verificationStatus: "approved",
    } as never,
  });
  const issue = runProfileHealthChecks(snap).find((i) => i.id === "TERMS_MISSING_BUT_PUBLISHED");
  assert.ok(issue);
  assert.equal(issue.severity, "high");
});
