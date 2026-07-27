import test from "node:test";
import assert from "node:assert/strict";

import {
  MIN_SEPARATION_DAYS,
  checkSeparationAge,
  isValidMicrochipNumber,
  isSwissMicrochip,
  checkListingLegality,
  formatAdoptionFee,
  amicusDeadline,
  ageInDays,
} from "../../lib/adoption/legal.ts";

const NOW = new Date("2026-07-27T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function born(daysAgo: number): Date {
  return new Date(NOW.getTime() - daysAgo * DAY);
}

test("checkSeparationAge enforces the 56-day rule (OPAn art. 70 al. 4)", () => {
  const tooYoung = checkSeparationAge(born(55), NOW);
  assert.equal(tooYoung.ok, false);
  assert.equal(tooYoung.daysOld, 55);
  assert.match(String(tooYoung.message), /56 jours/);

  // Exactly 56 days is legal — the boundary must not be off by one.
  const exactly = checkSeparationAge(born(MIN_SEPARATION_DAYS), NOW);
  assert.equal(exactly.ok, true);
  assert.equal(exactly.message, null);

  const adult = checkSeparationAge(born(900), NOW);
  assert.equal(adult.ok, true);
});

test("checkSeparationAge exposes the date the puppy becomes eligible", () => {
  const birth = born(30);
  const { eligibleFrom } = checkSeparationAge(birth, NOW);
  assert.equal(ageInDays(birth, eligibleFrom), MIN_SEPARATION_DAYS);
});

test("microchip numbers are 15 digits; the 756 prefix is Swiss but not required", () => {
  assert.equal(isValidMicrochipNumber("756098100123456"), true);
  assert.equal(isValidMicrochipNumber("  756098100123456  "), true);
  assert.equal(isValidMicrochipNumber("75609810012345"), false, "14 digits must fail");
  assert.equal(isValidMicrochipNumber("7560981001234567"), false, "16 digits must fail");
  assert.equal(isValidMicrochipNumber("756-0981-0012-3456"), false);
  assert.equal(isSwissMicrochip("756098100123456"), true);
  // Imported dogs carry a foreign country code and are still valid.
  assert.equal(isSwissMicrochip("642098100123456"), false);
  assert.equal(isValidMicrochipNumber("642098100123456"), true);
});

const VALID_LISTING = {
  microchipNumber: "756098100123456",
  provenance: "PRIVATE_OWNER",
  breedingCountry: "CH",
  cedantFullName: "Alexis Epremian",
  cedantAddress: "Rue du Lac 12",
  cedantPostalCode: "1006",
  cedantCity: "Lausanne",
  birthDate: born(400),
  photos: ["a.jpg"],
  description: "Chien très doux, habitué aux enfants, propre et sociable avec les autres chiens.",
};

test("checkListingLegality passes on a complete listing", () => {
  const res = checkListingLegality(VALID_LISTING, NOW);
  assert.equal(res.ok, true, JSON.stringify(res.issues));
  assert.equal(res.issues.length, 0);
});

test("checkListingLegality flags every art. 76d field independently", () => {
  const fields = ["cedantFullName", "cedantAddress", "cedantPostalCode", "cedantCity", "provenance", "breedingCountry"] as const;
  for (const field of fields) {
    const res = checkListingLegality({ ...VALID_LISTING, [field]: "" }, NOW);
    assert.equal(res.ok, false, `${field} must be mandatory`);
    assert.ok(res.issues.some((i) => i.field === field), `missing issue for ${field}`);
  }
});

test("checkListingLegality blocks a missing or malformed chip", () => {
  const missing = checkListingLegality({ ...VALID_LISTING, microchipNumber: null }, NOW);
  assert.ok(missing.issues.some((i) => i.field === "microchipNumber"));

  const malformed = checkListingLegality({ ...VALID_LISTING, microchipNumber: "1234" }, NOW);
  assert.ok(malformed.issues.some((i) => /15 chiffres/.test(i.message)));
});

test("checkListingLegality blocks a puppy under 56 days", () => {
  const res = checkListingLegality({ ...VALID_LISTING, birthDate: born(20) }, NOW);
  assert.equal(res.ok, false);
  assert.ok(res.issues.some((i) => i.field === "birthDate"));
});

test("checkListingLegality enforces the quality floor (photo + description)", () => {
  assert.ok(checkListingLegality({ ...VALID_LISTING, photos: [] }, NOW).issues.some((i) => i.field === "photos"));
  assert.ok(checkListingLegality({ ...VALID_LISTING, description: "trop court" }, NOW).issues.some((i) => i.field === "description"));
});

test("postal code must be 4 digits", () => {
  assert.ok(checkListingLegality({ ...VALID_LISTING, cedantPostalCode: "100" }, NOW).issues.some((i) => i.field === "cedantPostalCode"));
  assert.ok(checkListingLegality({ ...VALID_LISTING, cedantPostalCode: "CH-1006" }, NOW).issues.some((i) => i.field === "cedantPostalCode"));
});

test("formatAdoptionFee never says 'prix' and handles free cessions", () => {
  assert.equal(formatAdoptionFee(0), "Gratuit");
  assert.equal(formatAdoptionFee(-1), "Gratuit");
  assert.equal(formatAdoptionFee(35000), "CHF 350.– de participation aux frais");
  assert.equal(formatAdoptionFee(35050), "CHF 350.50 de participation aux frais");
  assert.doesNotMatch(formatAdoptionFee(35000), /prix/i);
});

test("amicusDeadline is 10 days after the cession", () => {
  const cession = new Date("2026-07-27T00:00:00Z");
  assert.equal(amicusDeadline(cession).toISOString(), "2026-08-06T00:00:00.000Z");
});
