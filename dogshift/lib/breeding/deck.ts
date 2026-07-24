/**
 * Pure builder for the swipe-deck query filter. Returns a plain object shaped
 * like a Prisma `MatingProfileWhereInput` (cast at the call site) so it stays
 * `@/`-free and unit-testable under `node --test`.
 */
import { sizeBucketFromWeight, type DogSexValue, type DogSizeBucket } from "./eligibility.ts";

export type DeckActiveDog = {
  /** MatingProfile.id of the swiping dog. */
  id: string;
  userId: string;
  sex: DogSexValue;
  breed: string | null;
};

export type DeckFilters = {
  breedMode?: "same" | "any";
  size?: DogSizeBucket | null;
  region?: string | null;
};

export function oppositeSex(sex: DogSexValue): DogSexValue {
  return sex === "MALE" ? "FEMALE" : "MALE";
}

/** Inclusive weight bounds (kg) for a size bucket, mirroring sizeBucketFromWeight. */
export function weightRangeForBucket(bucket: DogSizeBucket): { gte?: number; lt?: number; gt?: number; lte?: number } {
  if (bucket === "small") return { gt: 0, lt: 10 };
  if (bucket === "medium") return { gte: 10, lte: 25 };
  return { gt: 25 };
}

/**
 * Build the discovery filter for the active dog:
 * - only enabled profiles, never my own dogs
 * - opposite sex, and the target dog must not be sterilised (can't breed)
 * - exclude candidates I already swiped
 * - optional breed (same as mine), size (weight bucket) and region filters
 */
export function buildDeckWhere(active: DeckActiveDog, filters: DeckFilters = {}): Record<string, unknown> {
  const dog: Record<string, unknown> = {
    sex: oppositeSex(active.sex),
    neutered: { not: true },
  };

  if (filters.breedMode === "same" && active.breed && active.breed.trim()) {
    dog.breed = { equals: active.breed.trim(), mode: "insensitive" };
  }
  if (filters.size) {
    dog.weightKg = weightRangeForBucket(filters.size);
  }

  const where: Record<string, unknown> = {
    enabled: true,
    userId: { not: active.userId },
    dog: { is: dog },
    // Not already swiped (LIKE or PASS) by the active dog.
    swipesGot: { none: { swiperDogId: active.id } },
  };
  if (filters.region && filters.region.trim()) {
    where.region = filters.region.trim();
  }
  return where;
}

export { sizeBucketFromWeight };
