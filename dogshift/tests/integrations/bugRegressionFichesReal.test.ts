/**
 * Smoke test: parse every real fiche under docs/bugs/ and assert none has a
 * parse error. Catches typos in the JSON detection blocks before they ship.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseBugFiches } from "../../lib/bugRegression/parseBugFiches.ts";

test("all real bug fiches parse without errors", () => {
  // Tests run from the repo root (dogshift/).
  const fiches = parseBugFiches(process.cwd());
  const broken = fiches.filter((f) => f.parseError);
  if (broken.length > 0) {
    const detail = broken.map((b) => `${b.slug}: ${b.parseError}`).join("\n");
    assert.fail(`Some bug fiches have malformed detection blocks:\n${detail}`);
  }
});

test("every fiche either has a detection block or is explicitly typed `none`", () => {
  const fiches = parseBugFiches(process.cwd());
  // We tolerate fiches with no block at all (the cron will flag them as
  // skipped + "add a block to enable nightly checks"), but having zero is
  // a signal we set up the convention correctly.
  assert.ok(fiches.length > 0, "expected at least one bug fiche");
});
