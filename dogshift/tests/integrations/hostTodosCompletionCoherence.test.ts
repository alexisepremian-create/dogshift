import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { computeSitterProfileCompletionDetails } from "../../lib/sitterCompletion.ts";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * The dashboard "Compléter mon profil" bar (percent) and its checklist (todos)
 * must agree: every profile check that drags the % below 100 must surface an
 * actionable to-do. Otherwise the sitter sees "Tout est complété ✓" at 88 %
 * with nothing to fix (founder report — `address`/`identity` fed the % but had
 * no to-do). lib/hostProfile.ts imports `@/` aliases so it can't be imported
 * under `node --test`; we assert the % side behaviourally (sitterCompletion is
 * self-contained) and the to-do mapping by reading the source.
 */

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    avatarUrl: "https://example.com/avatar.jpg",
    firstName: "Sylvana",
    city: "Montreux",
    address: "Rue Industrielle 30",
    bio: "Je prendrai bien soin de votre animal.",
    services: { Promenade: true },
    pricing: { Promenade: 20 },
    acceptsSmall: true,
    acceptsMedium: true,
    acceptsLarge: false,
    stripeAccountStatus: "ENABLED",
    ...overrides,
  };
}

test("% side: missing address/identity drops below 100 (the 88 % the founder saw)", () => {
  const noAddress = computeSitterProfileCompletionDetails(makeProfile({ address: "" }));
  assert.equal(noAddress.checks.address, false);
  assert.equal(noAddress.percent, 88);

  const noIdentity = computeSitterProfileCompletionDetails(makeProfile({ city: "" }));
  assert.equal(noIdentity.checks.identity, false);
  assert.equal(noIdentity.percent, 88);
});

test("todo mapping: getHostTodos surfaces every percent-check, incl. identity + address", () => {
  const src = read("lib/hostProfile.ts");
  // Each of the 8 completion checks must push a to-do when it's false.
  for (const check of ["avatar", "identity", "address", "bio", "services", "pricing", "dogSizes", "stripeConnected"]) {
    assert.match(src, new RegExp(`if \\(!checks\\.${check}\\)`), `getHostTodos must surface a to-do for the '${check}' check.`);
  }
  // The two that used to be silent (no to-do) must now be present with labels.
  assert.match(src, /id: "identity"/, "identity to-do id must exist.");
  assert.match(src, /id: "address"/, "address to-do id must exist.");
});
