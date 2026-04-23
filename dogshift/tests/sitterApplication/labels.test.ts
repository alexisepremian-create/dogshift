import test from "node:test";
import assert from "node:assert/strict";

import {
  availabilityToRows,
  describeAvailabilitySlot,
  describeOtherAnimals,
  labelForDogSize,
  labelForGardeExperienceLevel,
  labelForGardeType,
  labelForHousingType,
  labelForLinkAnimalProfession,
} from "../../lib/sitterApplication/labels.ts";

// ---------------------------------------------------------------------------
// Simple slug → label mappings
// ---------------------------------------------------------------------------

test("labelForLinkAnimalProfession: known slug returns the French label", () => {
  assert.equal(
    labelForLinkAnimalProfession("asa"),
    "ASA (assistant·e en soins vétérinaires)",
  );
});

test("labelForLinkAnimalProfession: null / empty returns null", () => {
  assert.equal(labelForLinkAnimalProfession(null), null);
  assert.equal(labelForLinkAnimalProfession(""), null);
});

test("labelForLinkAnimalProfession: unknown slug falls back to slug as-is", () => {
  assert.equal(labelForLinkAnimalProfession("unknown_slug"), "unknown_slug");
});

test("labelForGardeExperienceLevel: maps professional to French label", () => {
  assert.equal(
    labelForGardeExperienceLevel("professional"),
    "Expérience professionnelle",
  );
});

test("labelForGardeType / labelForDogSize: readable French labels", () => {
  assert.equal(labelForGardeType("walks_only"), "Promenade");
  assert.equal(labelForGardeType("at_owner_home"), "Dogsitting (garde à la journée)");
  assert.equal(labelForDogSize("small"), "Petit (< 10 kg)");
  assert.equal(labelForDogSize("large"), "Grand (> 25 kg)");
});

test("labelForHousingType: maps known slugs and handles null", () => {
  assert.equal(labelForHousingType("house_with_garden"), "Maison avec jardin");
  assert.equal(labelForHousingType(null), null);
});

// ---------------------------------------------------------------------------
// Availability slot description
// ---------------------------------------------------------------------------

test("describeAvailabilitySlot: journeeEntiere wins over matin/apresMidi", () => {
  assert.equal(
    describeAvailabilitySlot({ matin: true, apresMidi: true, journeeEntiere: true }),
    "Journée entière",
  );
});

test("describeAvailabilitySlot: matin + apresMidi renders as '+'", () => {
  assert.equal(
    describeAvailabilitySlot({ matin: true, apresMidi: true, journeeEntiere: false }),
    "Matin + Après-midi",
  );
});

test("describeAvailabilitySlot: single matin or apresMidi", () => {
  assert.equal(describeAvailabilitySlot({ matin: true }), "Matin");
  assert.equal(describeAvailabilitySlot({ apresMidi: true }), "Après-midi");
});

test("describeAvailabilitySlot: empty slot returns dash", () => {
  assert.equal(describeAvailabilitySlot(null), "—");
  assert.equal(describeAvailabilitySlot(undefined), "—");
  assert.equal(describeAvailabilitySlot({}), "—");
});

test("availabilityToRows: all 7 days always present, in canonical order", () => {
  const rows = availabilityToRows({ lundi: { journeeEntiere: true } });
  assert.equal(rows.length, 7);
  assert.deepEqual(
    rows.map((r) => r.day),
    ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"],
  );
  assert.equal(rows[0]?.hasSlot, true);
  assert.equal(rows[0]?.description, "Journée entière");
  assert.equal(rows[1]?.hasSlot, false);
  assert.equal(rows[1]?.description, "—");
});

// ---------------------------------------------------------------------------
// Other animals description
// ---------------------------------------------------------------------------

test("describeOtherAnimals: none short-circuits everything", () => {
  assert.equal(
    describeOtherAnimals({ none: true, dogs: true, cats: true }),
    "Aucun",
  );
});

test("describeOtherAnimals: dogs with a count renders the count", () => {
  assert.equal(describeOtherAnimals({ dogs: true }, 2), "Chien(s) (2)");
});

test("describeOtherAnimals: combines dogs + cats + others", () => {
  assert.equal(
    describeOtherAnimals({ dogs: true, cats: true, others: true }, null),
    "Chien(s), Chat(s), Autres (NAC, oiseaux, rongeurs…)",
  );
});

test("describeOtherAnimals: null / empty returns dash", () => {
  assert.equal(describeOtherAnimals(null), "—");
  assert.equal(describeOtherAnimals({}), "—");
});
