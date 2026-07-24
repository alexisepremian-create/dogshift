import test from "node:test";
import assert from "node:assert/strict";

import { reportChecklistLines } from "../../lib/serviceReport/checklist.ts";

const empty = {
  peed: null,
  pooed: null,
  drankWater: null,
  ate: null,
  played: null,
  mood: null,
  energy: null,
};

test("reportChecklistLines: only truthy checklist items appear", () => {
  assert.deepEqual(reportChecklistLines(empty), []);
  assert.deepEqual(reportChecklistLines({ ...empty, peed: true, ate: false }), ["A fait pipi"]);
  assert.deepEqual(reportChecklistLines({ ...empty, peed: true, pooed: true, drankWater: true, ate: true, played: true }), [
    "A fait pipi",
    "A fait caca",
    "A bu de l'eau",
    "A mangé",
    "A joué / câlins",
  ]);
});

test("reportChecklistLines: mood is mapped to a FR label, unknown mood is dropped", () => {
  assert.deepEqual(reportChecklistLines({ ...empty, mood: "HAPPY" }), ["Humeur : Heureux"]);
  assert.deepEqual(reportChecklistLines({ ...empty, mood: "NOPE" }), []);
});

test("reportChecklistLines: energy renders as x/5 including 0", () => {
  assert.deepEqual(reportChecklistLines({ ...empty, energy: 4 }), ["Énergie : 4/5"]);
  assert.deepEqual(reportChecklistLines({ ...empty, energy: 0 }), ["Énergie : 0/5"]);
});
