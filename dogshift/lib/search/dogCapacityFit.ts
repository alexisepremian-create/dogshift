/**
 * Search-side capacity pre-filter: does a sitter accept the set of dogs the
 * owner picked on the homepage (counts per size), and do they have enough total
 * places?
 *
 * This is a PRE-filter for the search list. The precise, booking-aware capacity
 * check (remaining places given overlapping bookings) stays at booking time in
 * `lib/bookings/capacityCheck.ts → checkCapacityForBooking`. Here we only check:
 *   1. every requested size is accepted (acceptsSmall/Medium/Large), and
 *   2. total weighted demand ≤ the sitter's capacityPlaces.
 *
 * Weights (lib/constants/dog-sizes.ts): Petit=1, Moyen=2, Grand=3.
 */
import { DOG_SIZE_WEIGHTS, DEFAULT_CAPACITY_PLACES } from "../constants/dog-sizes.ts";

export type DogCounts = { petit: number; moyen: number; grand: number };

export type SitterCapacity = {
  acceptsSmall?: boolean | null;
  acceptsMedium?: boolean | null;
  acceptsLarge?: boolean | null;
  capacityPlaces?: number | null;
};

export function totalDogs(counts: DogCounts): number {
  return (counts.petit || 0) + (counts.moyen || 0) + (counts.grand || 0);
}

/** Weighted demand for the requested dogs (Petit=1, Moyen=2, Grand=3). */
export function weightedDemand(counts: DogCounts): number {
  return (
    (counts.petit || 0) * DOG_SIZE_WEIGHTS.small.weight +
    (counts.moyen || 0) * DOG_SIZE_WEIGHTS.medium.weight +
    (counts.grand || 0) * DOG_SIZE_WEIGHTS.large.weight
  );
}

/**
 * Whether a sitter can host the requested set of dogs. Returns true when no dogs
 * are requested (no filter).
 */
export function dogCountsFitSitter(counts: DogCounts, sitter: SitterCapacity): boolean {
  if (totalDogs(counts) <= 0) return true;

  // Every requested size must be accepted. A null/undefined acceptance column
  // means "not restricted" (DB default is true) → treat as accepted.
  if ((counts.petit || 0) > 0 && sitter.acceptsSmall === false) return false;
  if ((counts.moyen || 0) > 0 && sitter.acceptsMedium === false) return false;
  if ((counts.grand || 0) > 0 && sitter.acceptsLarge === false) return false;

  const places =
    typeof sitter.capacityPlaces === "number" && sitter.capacityPlaces > 0
      ? sitter.capacityPlaces
      : DEFAULT_CAPACITY_PLACES;

  return weightedDemand(counts) <= places;
}
