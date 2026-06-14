/**
 * Regression: the search "taille" filter must reflect the sitter's REAL
 * accepted sizes (the capacity booleans = what booking enforces), not the
 * legacy `dogSizes` JSON which can drift / hold EN codes.
 *
 * `resolveSitterDogSizes` (lib/sitterDogSizes.ts) is what /api/sitters now uses
 * to produce the `dogSizes` array the search client filters on.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { resolveSitterDogSizes, parseLegacyDogSizes } from "../../lib/sitterDogSizes.ts";

test("capacity booleans are authoritative (subset)", () => {
  assert.deepEqual(
    resolveSitterDogSizes({
      acceptsSmall: true,
      acceptsMedium: false,
      acceptsLarge: true,
      // legacy JSON disagrees — must be IGNORED in favour of the booleans
      dogSizesJson: ["Petit", "Moyen", "Grand"],
    }),
    ["Petit", "Grand"],
  );
});

test("all-true booleans → all three sizes", () => {
  assert.deepEqual(
    resolveSitterDogSizes({ acceptsSmall: true, acceptsMedium: true, acceptsLarge: true }),
    ["Petit", "Moyen", "Grand"],
  );
});

test("only large accepted", () => {
  assert.deepEqual(
    resolveSitterDogSizes({ acceptsSmall: false, acceptsMedium: false, acceptsLarge: true }),
    ["Grand"],
  );
});

test("falls back to legacy FR-label array when booleans absent", () => {
  assert.deepEqual(
    resolveSitterDogSizes({ dogSizesJson: ["Petit", "Grand"] }),
    ["Petit", "Grand"],
  );
});

test("falls back to legacy EN codes (from the application form)", () => {
  assert.deepEqual(
    resolveSitterDogSizes({ dogSizesJson: ["small", "large"] }),
    ["Petit", "Grand"],
  );
});

test("falls back to legacy boolean record", () => {
  assert.deepEqual(
    resolveSitterDogSizes({ dogSizesJson: { Petit: true, Moyen: false, Grand: true } }),
    ["Petit", "Grand"],
  );
});

test("no data → empty", () => {
  assert.deepEqual(resolveSitterDogSizes({ dogSizesJson: null }), []);
});

test("parseLegacyDogSizes normalizes and orders mixed input", () => {
  assert.deepEqual(parseLegacyDogSizes(["large", "Petit", "medium"]), ["Petit", "Moyen", "Grand"]);
});
