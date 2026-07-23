import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Publishing now requires availability. sitterGuards.ts imports via the "@/"
// alias (unresolvable in the node test runner), so we lock the contract with
// file-level asserts — same approach as sitterTermsModalGate.test.ts.

function read(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

test("gate defines the NO_AVAILABILITY branch", () => {
  const src = read("../../lib/sitterGuards.ts");
  assert.match(src, /error:\s*"NO_AVAILABILITY"/, "gate must be able to return NO_AVAILABILITY");
  assert.match(
    src,
    /hasAvailabilityForActiveServices\s*===\s*false/,
    "gate must block publish when availability is explicitly false (undefined = skip)",
  );
});

test("availability check comes AFTER activation (lower priority)", () => {
  const src = read("../../lib/sitterGuards.ts");
  const activationIdx = src.indexOf('"ACCOUNT_NOT_ACTIVATED"');
  const availabilityIdx = src.indexOf('"NO_AVAILABILITY"');
  assert.ok(activationIdx > -1 && availabilityIdx > -1);
  assert.ok(
    availabilityIdx > activationIdx,
    "terms/completion/activation must take priority over availability in the gate",
  );
});

test("publish route wires availability coverage into the gate", () => {
  const src = read("../../app/api/host/profile/route.ts");
  assert.match(src, /getSitterAvailabilityCoverage/, "route must compute availability coverage");
  assert.match(src, /hasAvailabilityForActiveServices:\s*coverage\.ok/, "route must pass coverage.ok to the gate");
});

test("both publish-blocked message maps handle NO_AVAILABILITY", () => {
  const dashboard = read("../../app/(protected)/host/page.tsx");
  const edit = read("../../app/(protected)/host/profile/edit/page.tsx");
  assert.match(dashboard, /NO_AVAILABILITY:\s*"/, "dashboard message map must cover NO_AVAILABILITY");
  assert.match(edit, /NO_AVAILABILITY:\s*"/, "edit page message map must cover NO_AVAILABILITY");
});
