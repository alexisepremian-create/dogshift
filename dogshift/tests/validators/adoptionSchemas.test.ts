import test from "node:test";
import assert from "node:assert/strict";

import {
  adopterProfileSchema,
  applicationDecisionSchema,
  listingCreateSchema,
  listingFeedQuerySchema,
  listingPublishSchema,
  listingUpdateSchema,
} from "../../lib/validators/adoption.ts";

const DRAFT = {
  dogName: "Nala",
  sex: "FEMALE",
  birthDate: "2026-03-01",
  sizeCategory: "MEDIUM",
  provenance: "PRIVATE_OWNER",
};

test("a draft only needs the dog's identity — the legal fields come later", () => {
  const parsed = listingCreateSchema.safeParse(DRAFT);
  assert.equal(parsed.success, true);
});

test("but the draft cannot skip birthDate: the 56-day rule has no placeholder", () => {
  const withoutBirthDate = { ...DRAFT, birthDate: undefined };
  assert.equal(listingCreateSchema.safeParse(withoutBirthDate).success, false);
  assert.equal(listingCreateSchema.safeParse({ ...DRAFT, birthDate: "01.03.2026" }).success, false);
});

test("microchip, NPA, canton and country codes are format-checked", () => {
  assert.equal(listingUpdateSchema.safeParse({ microchipNumber: "756098100123456" }).success, true);
  assert.equal(listingUpdateSchema.safeParse({ microchipNumber: "75609810012345" }).success, false, "14 digits");
  assert.equal(listingUpdateSchema.safeParse({ cedantPostalCode: "1003" }).success, true);
  assert.equal(listingUpdateSchema.safeParse({ cedantPostalCode: "103" }).success, false);
  assert.equal(listingUpdateSchema.safeParse({ canton: "VD" }).success, true);
  assert.equal(listingUpdateSchema.safeParse({ canton: "vd" }).success, false);
  assert.equal(listingUpdateSchema.safeParse({ breedingCountry: "RO" }).success, true);
  assert.equal(listingUpdateSchema.safeParse({ breedingCountry: "ROU" }).success, false);
});

test("an empty PATCH is rejected instead of silently touching updatedAt", () => {
  assert.equal(listingUpdateSchema.safeParse({}).success, false);
});

test("photos are not settable through the listing schemas — they go through presign/commit", () => {
  const parsed = listingUpdateSchema.safeParse({ dogName: "Nala", photos: ["dog-photos/x/y.jpg"] });
  assert.equal(parsed.success, true);
  assert.equal("photos" in (parsed.success ? parsed.data : {}), false);
});

test("publishing requires an explicit acceptance of the legal statement", () => {
  assert.equal(listingPublishSchema.safeParse({ acceptTerms: true }).success, true);
  assert.equal(listingPublishSchema.safeParse({ acceptTerms: false }).success, false);
  assert.equal(listingPublishSchema.safeParse({}).success, false);
});

test("the fee is capped: a four-figure ask is a sale, not a participation aux frais", () => {
  assert.equal(listingUpdateSchema.safeParse({ feeAmount: 0 }).success, true);
  assert.equal(listingUpdateSchema.safeParse({ feeAmount: 300000 }).success, true);
  assert.equal(listingUpdateSchema.safeParse({ feeAmount: 300001 }).success, false);
  assert.equal(listingUpdateSchema.safeParse({ feeAmount: -1 }).success, false);
  assert.equal(listingUpdateSchema.safeParse({ feeAmount: 12.5 }).success, false, "centimes are integers");
});

test("feed query coerces strings and rejects malformed lists", () => {
  const parsed = listingFeedQuerySchema.safeParse({
    cantons: "VD,GE",
    sizes: "SMALL,LARGE",
    minAgeMonths: "12",
    goodWithChildren: "1",
    verifiedOnly: "true",
    limit: "20",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.minAgeMonths, 12);
    assert.equal(parsed.data.goodWithChildren, true);
    assert.equal(parsed.data.verifiedOnly, true);
    assert.equal(parsed.data.limit, 20);
  }

  assert.equal(listingFeedQuerySchema.safeParse({ cantons: "vd,ge" }).success, false);
  assert.equal(listingFeedQuerySchema.safeParse({ sizes: "TINY" }).success, false);
  assert.equal(listingFeedQuerySchema.safeParse({ limit: "500" }).success, false);
});

const DOSSIER = {
  housingType: "HOUSE",
  isHomeOwner: true,
  householdAdults: 2,
  householdChildren: 0,
  experienceLevel: 3,
  consentShared: true,
};

test("an owner-occupier does not have to answer the landlord question", () => {
  assert.equal(adopterProfileSchema.safeParse(DOSSIER).success, true);
});

test("a renter must state whether the landlord allows dogs", () => {
  const renter = { ...DOSSIER, isHomeOwner: false, landlordApproval: null };
  assert.equal(adopterProfileSchema.safeParse(renter).success, false);
  assert.equal(adopterProfileSchema.safeParse({ ...renter, landlordApproval: false }).success, true);
});

test("declaring children requires the youngest child's age", () => {
  assert.equal(adopterProfileSchema.safeParse({ ...DOSSIER, householdChildren: 2 }).success, false);
  assert.equal(
    adopterProfileSchema.safeParse({ ...DOSSIER, householdChildren: 2, youngestChildAge: 3 }).success,
    true
  );
});

test("a refusal must carry a reason — an unexplained no is what makes adopters quit", () => {
  assert.equal(applicationDecisionSchema.safeParse({ status: "DECLINED" }).success, false);
  assert.equal(
    applicationDecisionSchema.safeParse({ status: "DECLINED", declineReason: "Trop loin" }).success,
    true
  );
  assert.equal(applicationDecisionSchema.safeParse({ status: "SHORTLISTED" }).success, true);
  assert.equal(applicationDecisionSchema.safeParse({ status: "ACCEPTED" }).success, true);
  assert.equal(
    applicationDecisionSchema.safeParse({ status: "PENDING" }).success,
    false,
    "a cédant cannot move an application back to PENDING"
  );
});
