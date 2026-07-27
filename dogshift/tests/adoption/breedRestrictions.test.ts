import test from "node:test";
import assert from "node:assert/strict";

import { checkBreedRestriction, matchBreedKeys } from "../../lib/adoption/breedRestrictions.ts";
import { requiresOwnerCourse, requiresLiabilityInsurance, isCantonCode, cantonName } from "../../lib/adoption/cantons.ts";

test("matchBreedKeys normalises case, accents and punctuation", () => {
  assert.deepEqual(matchBreedKeys("American Staffordshire Terrier"), ["american_staffordshire_terrier"]);
  assert.deepEqual(matchBreedKeys("amstaff"), ["american_staffordshire_terrier"]);
  assert.deepEqual(matchBreedKeys("Américain Staffordshire-Terrier"), ["american_staffordshire_terrier"]);
  assert.deepEqual(matchBreedKeys("ROTTWEILER"), ["rottweiler"]);
  assert.deepEqual(matchBreedKeys("Labrador"), []);
  assert.deepEqual(matchBreedKeys(null, undefined), []);
});

test("matchBreedKeys reads the secondary breed too", () => {
  const keys = matchBreedKeys("Labrador", "croisé Rottweiler");
  assert.ok(keys.includes("rottweiler"));
});

test("Geneva bans the listed breeds outright", () => {
  const res = checkBreedRestriction({ canton: "GE", breed: "American Staffordshire Terrier" });
  assert.equal(res.level, "BANNED");
  assert.match(res.message, /interdite dans le canton GE/);
  assert.ok(res.source);
});

test("Vaud requires an authorisation rather than banning", () => {
  const res = checkBreedRestriction({ canton: "VD", breed: "Rottweiler" });
  assert.equal(res.level, "PERMIT_REQUIRED");
  assert.match(res.message, /autorisation/);
});

test("the same breed can be legal, permitted or banned depending on the canton", () => {
  assert.equal(checkBreedRestriction({ canton: "BE", breed: "Rottweiler" }).level, "NONE");
  assert.equal(checkBreedRestriction({ canton: "VD", breed: "Rottweiler" }).level, "PERMIT_REQUIRED");
  assert.equal(checkBreedRestriction({ canton: "ZH", breed: "Rottweiler" }).level, "BANNED");
});

test("crossbreeds of a listed breed are covered by the ban", () => {
  const res = checkBreedRestriction({ canton: "GE", breed: "Croisé Pitbull", isCrossbreed: true });
  assert.equal(res.level, "BANNED");
});

test("unrestricted breeds and unregulated cantons return NONE with no source", () => {
  const a = checkBreedRestriction({ canton: "GE", breed: "Golden Retriever" });
  assert.equal(a.level, "NONE");
  assert.equal(a.source, null);

  const b = checkBreedRestriction({ canton: "JU", breed: "American Pit Bull Terrier" });
  assert.equal(b.level, "NONE");
});

test("every restriction carries the review date so the UI can date it", () => {
  const res = checkBreedRestriction({ canton: "VS", breed: "Tosa" });
  assert.equal(res.level, "BANNED");
  assert.match(res.reviewedOn, /^\d{4}-\d{2}-\d{2}$/);
});

test("cantonal course + RC insurance reminders", () => {
  assert.equal(requiresOwnerCourse("FR").required, true);
  assert.match(String(requiresOwnerCourse("FR").detail), /18 mois/);
  assert.equal(requiresOwnerCourse("VD").required, false);
  assert.equal(requiresOwnerCourse("VD").detail, null);

  assert.equal(requiresLiabilityInsurance("ZH"), true);
  assert.equal(requiresLiabilityInsurance("VD"), false);
});

test("canton helpers", () => {
  assert.equal(isCantonCode("VD"), true);
  assert.equal(isCantonCode("XX"), false);
  assert.equal(cantonName("GE"), "Genève");
  assert.equal(cantonName("XX"), "XX");
});
