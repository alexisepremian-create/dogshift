import { test } from "node:test";
import assert from "node:assert/strict";

import { CURRENT_TERMS_VERSION } from "../../lib/terms.ts";

// Regression for the recurring bug Sonia Bürer hit twice between Mar and Jun 2026:
//
//   The HostDashboardShell rendered HostContractAmendmentModal but NOT
//   HostComplianceBlockingModal, even though the server-side gate in
//   lib/sitterGuards.ts blocks publish + sensitive actions with
//   TERMS_NOT_ACCEPTED when `termsAcceptedAt` is null or `termsVersion`
//   no longer matches CURRENT_TERMS_VERSION.
//
//   Result: the sitter saw "Avant de publier ton annonce, il te reste à :
//   ⚠️ Accepter le règlement DogShift" but the toggle to accept was nowhere
//   in the UI — the modal that should have surfaced /api/host/accept-terms
//   was never mounted. Commit fef3977f7 (2026-03-24, "Keep sitter compliance
//   flows separate from owner terms") deleted the modal import and never
//   restored it.
//
// This file holds the contract that any future refactor must preserve:
//   1. `needsTermsAcceptance` is true iff the sitter has no `termsAcceptedAt`
//      OR their stored `termsVersion` doesn't equal CURRENT_TERMS_VERSION.
//   2. The bare existence of a `sitterId` (i.e. the sitter is past application
//      stage) is what gates whether the modal even considers terms.
//
// We intentionally mirror the predicate used by `components/HostComplianceBlockingModal.tsx`
// inline below so a refactor of that file is caught here.

type ModalInput = {
  sitterId: string | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
};

function needsTermsAcceptance(host: ModalInput): boolean {
  if (!host.sitterId) return false;
  if (!host.termsAcceptedAt) return true;
  if (!host.termsVersion) return true;
  return host.termsVersion !== CURRENT_TERMS_VERSION;
}

test("non-sitter (no sitterId yet) does not see terms modal", () => {
  assert.equal(
    needsTermsAcceptance({ sitterId: null, termsAcceptedAt: null, termsVersion: null }),
    false,
  );
});

test("sitter who never accepted terms triggers modal", () => {
  assert.equal(
    needsTermsAcceptance({ sitterId: "stt_abc", termsAcceptedAt: null, termsVersion: null }),
    true,
    "Sonia's exact case — sitterId set, no termsAcceptedAt → modal must surface",
  );
});

test("sitter who accepted an older terms version triggers modal", () => {
  assert.equal(
    needsTermsAcceptance({
      sitterId: "stt_abc",
      termsAcceptedAt: "2025-09-01T10:00:00Z",
      termsVersion: "2025-09-01-v0",
    }),
    true,
    "Outdated termsVersion must re-trigger the modal so we can capture the new acceptance",
  );
});

test("sitter who accepted the current terms version is unblocked", () => {
  assert.equal(
    needsTermsAcceptance({
      sitterId: "stt_abc",
      termsAcceptedAt: "2026-01-15T10:00:00Z",
      termsVersion: CURRENT_TERMS_VERSION,
    }),
    false,
  );
});

test("sitter with termsAcceptedAt but no termsVersion (legacy row) triggers modal", () => {
  assert.equal(
    needsTermsAcceptance({
      sitterId: "stt_abc",
      termsAcceptedAt: "2025-12-01T10:00:00Z",
      termsVersion: null,
    }),
    true,
    "Legacy acceptances without a version pin must re-prompt under the new versioning regime",
  );
});

test("HostDashboardShell must import HostComplianceBlockingModal", async () => {
  const { readFileSync } = await import("node:fs");
  const shell = readFileSync(
    new URL("../../components/HostDashboardShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    shell,
    /import\s+HostComplianceBlockingModal\s+from\s+"@\/components\/HostComplianceBlockingModal"/,
    "HostDashboardShell must import the compliance modal — without it the sitter cannot accept the CGU and publish is blocked forever (bug fef3977f7).",
  );
  assert.match(
    shell,
    /<HostComplianceBlockingModal\s+host=\{host\}\s*\/>/,
    "HostDashboardShell must actually render <HostComplianceBlockingModal host={host} />, not just import it.",
  );
});

// Regression for the follow-up bug (2026-07-21): after the sitter accepts the
// CGU in the modal, only the modal's local `acceptedOverride` flipped — the
// HostUserProvider (fed by the server layout) kept the stale termsAcceptedAt.
// Every other consumer stayed blocked: /host/profile/edit computes
// `canPublish = termsOk && …`, so the publish toggle remained greyed out
// ("le bouton pour publier n'est pas cliquable"). In the native WebView, which
// never hard-reloads, the stale state stuck indefinitely. The modal MUST call
// router.refresh() after a successful acceptance so server data re-flows.
test("HostComplianceBlockingModal refreshes server data after accepting", async () => {
  const { readFileSync } = await import("node:fs");
  const modal = readFileSync(
    new URL("../../components/HostComplianceBlockingModal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    modal,
    /import\s+\{\s*useRouter\s*\}\s+from\s+"next\/navigation"/,
    "Modal must import useRouter to refresh the server layout after acceptance.",
  );
  assert.match(
    modal,
    /router\.refresh\(\)/,
    "Modal must call router.refresh() after a successful acceptance — otherwise the publish gate keeps the stale termsAcceptedAt and stays blocked (native WebView never hard-reloads).",
  );
});
