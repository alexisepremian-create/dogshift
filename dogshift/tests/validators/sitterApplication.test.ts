import test from "node:test";
import assert from "node:assert/strict";

import {
  countFullDays,
  emptyAvailabilityGrid,
  formatSwissPhoneDisplay,
  hasAnyAvailabilitySlot,
  isValidSwissPhone,
  normalizeSwissPhone,
  SWISS_NPA_REGEX,
} from "../../lib/sitterApplication/options.ts";

import { sitterApplicationSchemaV2 } from "../../lib/sitterApplication/schema.ts";

// ---------------------------------------------------------------------------
// Swiss phone normalisation
// ---------------------------------------------------------------------------

test("normalizeSwissPhone accepts +41 with spaces", () => {
  assert.equal(normalizeSwissPhone("+41 79 123 45 67"), "+41791234567");
});

test("normalizeSwissPhone converts 0041 prefix to +41", () => {
  assert.equal(normalizeSwissPhone("0041791234567"), "+41791234567");
});

test("normalizeSwissPhone converts national 0XX to +41", () => {
  assert.equal(normalizeSwissPhone("0791234567"), "+41791234567");
});

test("normalizeSwissPhone strips dashes and parentheses", () => {
  assert.equal(normalizeSwissPhone("+41 (79) 123-45-67"), "+41791234567");
});

test("isValidSwissPhone accepts canonical form", () => {
  assert.equal(isValidSwissPhone("+41791234567"), true);
});

test("isValidSwissPhone rejects wrong length", () => {
  assert.equal(isValidSwissPhone("+4179123456"), false);
  assert.equal(isValidSwissPhone("+417912345678"), false);
});

test("isValidSwissPhone rejects foreign numbers", () => {
  assert.equal(isValidSwissPhone("+33612345678"), false);
});

test("formatSwissPhoneDisplay groups digits visually", () => {
  assert.equal(formatSwissPhoneDisplay("+41791234567"), "+41 79 123 45 67");
  assert.equal(formatSwissPhoneDisplay("+4179123"), "+41 79 123");
  assert.equal(formatSwissPhoneDisplay(""), "");
});

// ---------------------------------------------------------------------------
// Swiss NPA regex
// ---------------------------------------------------------------------------

test("SWISS_NPA_REGEX accepts typical Swiss postal codes", () => {
  assert.ok(SWISS_NPA_REGEX.test("1004"));
  assert.ok(SWISS_NPA_REGEX.test("1800"));
  assert.ok(SWISS_NPA_REGEX.test("9999"));
});

test("SWISS_NPA_REGEX rejects invalid codes", () => {
  assert.equal(SWISS_NPA_REGEX.test("0123"), false); // starts with 0
  assert.equal(SWISS_NPA_REGEX.test("12345"), false); // too long
  assert.equal(SWISS_NPA_REGEX.test("12a4"), false); // non-digit
});

// ---------------------------------------------------------------------------
// Availability grid helpers
// ---------------------------------------------------------------------------

test("emptyAvailabilityGrid has no slots selected", () => {
  const grid = emptyAvailabilityGrid();
  assert.equal(hasAnyAvailabilitySlot(grid), false);
  assert.equal(countFullDays(grid), 0);
});

test("hasAnyAvailabilitySlot detects a single tick", () => {
  const grid = emptyAvailabilityGrid();
  grid.mardi.matin = true;
  assert.equal(hasAnyAvailabilitySlot(grid), true);
});

test("countFullDays counts only journee entiere", () => {
  const grid = emptyAvailabilityGrid();
  grid.lundi.journeeEntiere = true;
  grid.mardi.journeeEntiere = true;
  grid.mercredi.matin = true;
  assert.equal(countFullDays(grid), 2);
});

// ---------------------------------------------------------------------------
// Full schema happy-path + representative error cases
// ---------------------------------------------------------------------------

function baseValidPayload() {
  const availability = emptyAvailabilityGrid();
  availability.lundi.journeeEntiere = true;
  availability.lundi.matin = true;
  availability.lundi.apresMidi = true;
  availability.mardi.journeeEntiere = true;
  availability.mardi.matin = true;
  availability.mardi.apresMidi = true;
  availability.mercredi.journeeEntiere = true;
  availability.mercredi.matin = true;
  availability.mercredi.apresMidi = true;

  return {
    firstName: "Jeanne",
    lastName: "Dupont",
    email: "jeanne@example.ch",
    phone: "+41791234567",
    age: 32,
    city: "Lausanne" as const,
    cityOther: "",
    npa: "1004",

    linkAnimalProfession: "asa" as const,
    linkAnimalProfessionOther: "",
    gardeExperienceLevel: "regular_1_3y" as const,
    experienceText:
      "Plusieurs années d'expérience avec des chiens de tailles variées, promenades, gardes régulières.",
    motivationText:
      "Je souhaite rejoindre DogShift parce que j'aime profondément les chiens et je veux offrir un service de garde sérieux et bienveillant, local, en Suisse romande.",
    allergies: "",

    availabilityStructured: availability,
    gardeTypes: ["at_my_home" as const, "walks_only" as const],
    dogSizes: ["small" as const, "medium" as const],
    housingType: "apartment_with_outdoor" as const,
    housingTypeOther: "",
    otherAnimals: { none: true, dogs: false, cats: false, others: false },
    otherAnimalsDogCount: null as number | null,
    hasCarLicense: true,
    consentInterview: true,
    consentPrivacy: true,
  };
}

test("sitterApplicationSchemaV2 accepts a well-formed payload", () => {
  const res = sitterApplicationSchemaV2.safeParse(baseValidPayload());
  if (!res.success) {
    console.error(res.error.issues);
  }
  assert.equal(res.success, true);
});

test("sitterApplicationSchemaV2 rejects non-Swiss phone", () => {
  const payload = baseValidPayload();
  payload.phone = "+33612345678";
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});

test("sitterApplicationSchemaV2 requires cityOther when city=Autre", () => {
  const payload = baseValidPayload();
  // @ts-expect-error — exercising the "Autre" branch
  payload.city = "Autre";
  payload.cityOther = "";
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});

test("sitterApplicationSchemaV2 rejects empty availability grid", () => {
  const payload = baseValidPayload();
  payload.availabilityStructured = emptyAvailabilityGrid();
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});

test("sitterApplicationSchemaV2 requires at least 1 sitting type", () => {
  const payload = baseValidPayload();
  payload.gardeTypes = [];
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});

test("sitterApplicationSchemaV2 requires at least 1 dog size", () => {
  const payload = baseValidPayload();
  payload.dogSizes = [];
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});

test("sitterApplicationSchemaV2 rejects motivation < 80 chars", () => {
  const payload = baseValidPayload();
  payload.motivationText = "trop court";
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});

test("sitterApplicationSchemaV2 rejects otherAnimals=none combined with others", () => {
  const payload = baseValidPayload();
  payload.otherAnimals = { none: true, dogs: true, cats: false, others: false };
  payload.otherAnimalsDogCount = 2;
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});

test("sitterApplicationSchemaV2 requires dog count when dogs=true", () => {
  const payload = baseValidPayload();
  payload.otherAnimals = { none: false, dogs: true, cats: false, others: false };
  payload.otherAnimalsDogCount = null;
  const res = sitterApplicationSchemaV2.safeParse(payload);
  assert.equal(res.success, false);
});
