import test from "node:test";
import assert from "node:assert/strict";

import { snapshotAdopterDossier, type AdopterDossierSource } from "../../lib/adoption/dossier.ts";

const CONSENT = new Date("2026-07-20T09:00:00.000Z");
const NOW = new Date("2026-07-27T12:00:00.000Z");

function profile(over: Partial<AdopterDossierSource> = {}): AdopterDossierSource {
  return {
    housingType: "APARTMENT",
    isHomeOwner: false,
    landlordApproval: true,
    hasGarden: false,
    gardenFenced: null,
    householdAdults: 2,
    householdChildren: 1,
    youngestChildAge: 6,
    hasOtherDogs: false,
    hasCats: true,
    otherPetsNote: "Un chat de 4 ans",
    hoursAlonePerDay: 4,
    experienceLevel: 3,
    previousDogsNote: null,
    activityLevel: 4,
    canton: "VD",
    city: "Lausanne",
    motivation: "On a de la place et du temps",
    consentSharedAt: CONSENT,
    ...over,
  };
}

test("the snapshot carries every dossier answer the cédant needs", () => {
  const snap = snapshotAdopterDossier(profile(), NOW);
  assert.equal(snap.housingType, "APARTMENT");
  assert.equal(snap.landlordApproval, true);
  assert.equal(snap.householdChildren, 1);
  assert.equal(snap.youngestChildAge, 6);
  assert.equal(snap.hasCats, true);
  assert.equal(snap.experienceLevel, 3);
  assert.equal(snap.city, "Lausanne");
});

test("timestamps are serialised as ISO strings so the row survives Json storage", () => {
  const snap = snapshotAdopterDossier(profile(), NOW);
  assert.equal(snap.consentSharedAt, CONSENT.toISOString());
  assert.equal(snap.snapshotAt, NOW.toISOString());
  assert.equal(JSON.parse(JSON.stringify(snap)).snapshotAt, NOW.toISOString());
});

test("snapshotAt is when the application was sent, not when consent was given", () => {
  const snap = snapshotAdopterDossier(profile(), NOW);
  assert.notEqual(snap.snapshotAt, snap.consentSharedAt);
});

test("a missing consent is preserved as null rather than defaulted", () => {
  const snap = snapshotAdopterDossier(profile({ consentSharedAt: null }), NOW);
  assert.equal(snap.consentSharedAt, null);
});

test("editing the profile afterwards cannot rewrite an existing snapshot (nLPD)", () => {
  const source = profile();
  const snap = snapshotAdopterDossier(source, NOW);
  source.motivation = "Texte réécrit après coup";
  source.householdChildren = 4;
  assert.equal(snap.motivation, "On a de la place et du temps");
  assert.equal(snap.householdChildren, 1);
});
