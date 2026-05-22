import { test } from "node:test";
import assert from "node:assert/strict";

import { formatRecap } from "../../lib/bugRegression/telegramRecap.ts";
import type { FicheResult } from "../../lib/bugRegression/runDetections.ts";

// Regression: the user complained that the nightly recap didn't tell them
// at a glance whether they had to do anything. The first line of the
// message must now be a clear "Action requise : OUI | NON" indicator.

function fakeResult(slug: string, status: "pass" | "fail" | "error" | "skipped", reason = ""): FicheResult {
  return {
    slug,
    detection: status === "skipped" ? { type: "none", reason } : null,
    outcome: {
      status,
      detail: status === "fail" ? "Régression détectée" : "",
    },
  } as FicheResult;
}

const FIXED_DATE = new Date("2026-05-22T02:07:00Z");

test("clean recap surfaces 'Action requise : NON' on the first line under the header", () => {
  const out = formatRecap(
    [fakeResult("foo", "pass"), fakeResult("bar", "pass")],
    FIXED_DATE,
  );
  assert.ok(out.includes("Action requise : NON"), `missing NON indicator. Output:\n${out}`);
  assert.ok(out.includes("tout est OK"), `missing reassuring sub-line. Output:\n${out}`);
  assert.ok(!out.includes("Action requise : OUI"));
});

test("regression detected surfaces 'Action requise : OUI'", () => {
  const out = formatRecap(
    [fakeResult("foo", "pass"), fakeResult("baz", "fail")],
    FIXED_DATE,
  );
  assert.ok(out.includes("Action requise : OUI"), `missing OUI indicator. Output:\n${out}`);
  assert.ok(out.includes("ancien bug est revenu"));
});

test("only-error case uses 'À investiguer' wording, not OUI/NON", () => {
  const out = formatRecap(
    [fakeResult("foo", "pass"), fakeResult("qux", "error")],
    FIXED_DATE,
  );
  assert.ok(out.includes("À investiguer"), `missing erreur wording. Output:\n${out}`);
  assert.ok(out.includes("problème du test lui-même"));
  assert.ok(!out.includes("Action requise : OUI"));
  assert.ok(!out.includes("Action requise : NON"));
});

test("'ignorée' wording is replaced with 'vérification manuelle' to avoid confusion", () => {
  const out = formatRecap(
    [
      fakeResult("foo", "pass"),
      fakeResult("manual-only", "skipped", "bug iOS Safari, nécessite un téléphone physique"),
    ],
    FIXED_DATE,
  );
  // Summary line should use the new word.
  assert.ok(out.includes("vérification manuelle"), `missing new wording. Output:\n${out}`);
  // The section header for intentionally-skipped fiches should reference the
  // manual-check nature too.
  assert.ok(out.includes("vérifier à la main"), `missing manual-check section header. Output:\n${out}`);
});
