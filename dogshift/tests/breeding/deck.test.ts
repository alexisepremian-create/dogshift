import test from "node:test";
import assert from "node:assert/strict";

import { buildDeckWhere, oppositeSex, weightRangeForBucket, type DeckActiveDog } from "../../lib/breeding/deck.ts";

// The builder returns a dynamically-shaped Prisma where object; assert on it loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const male: DeckActiveDog = { id: "mp_me", userId: "u_me", sex: "MALE", breed: "Labrador" };

test("oppositeSex flips", () => {
  assert.equal(oppositeSex("MALE"), "FEMALE");
  assert.equal(oppositeSex("FEMALE"), "MALE");
});

test("deck excludes my dogs, same sex, sterilised, and already-swiped", () => {
  const where = buildDeckWhere(male) as AnyRecord;
  assert.equal(where.enabled, true);
  assert.deepEqual(where.userId, { not: "u_me" });
  assert.equal(where.dog.is.sex, "FEMALE");
  assert.deepEqual(where.dog.is.neutered, { not: true });
  assert.deepEqual(where.swipesGot, { none: { swiperDogId: "mp_me" } });
});

test("breedMode:same filters on the active dog's breed (case-insensitive)", () => {
  const same = buildDeckWhere(male, { breedMode: "same" }) as AnyRecord;
  assert.deepEqual(same.dog.is.breed, { equals: "Labrador", mode: "insensitive" });
  const any = buildDeckWhere(male, { breedMode: "any" }) as AnyRecord;
  assert.equal(any.dog.is.breed, undefined);
});

test("size filter maps to a weight range; region filters when present", () => {
  const w = buildDeckWhere(male, { size: "medium", region: "Vaud" }) as AnyRecord;
  assert.deepEqual(w.dog.is.weightKg, { gte: 10, lte: 25 });
  assert.equal(w.region, "Vaud");
  assert.deepEqual(weightRangeForBucket("small"), { gt: 0, lt: 10 });
  assert.deepEqual(weightRangeForBucket("large"), { gt: 25 });
});
