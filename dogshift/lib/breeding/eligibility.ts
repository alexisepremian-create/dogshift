/**
 * Pure, dependency-free breeding-eligibility helpers for the "Tinder pour chiens"
 * feature. No `@/` imports on purpose so they run directly under `node --test`.
 */

export type DogSexValue = "MALE" | "FEMALE";

export type EnableEligibility = { ok: true } | { ok: false; reason: "SEX_REQUIRED" };

/**
 * A dog can opt into the breeding-match feature only once its sex is known —
 * opposite-sex matching depends on it. Sterilised dogs may hold a profile but
 * are filtered out of the swipe deck (see lib/breeding/deck): a castrated dog
 * can't reproduce, so it never surfaces as a candidate. (Founder chose light
 * legal gating; `sex` is the single functional requirement to enable.)
 */
export function canEnableMating(dog: { sex: DogSexValue | null | undefined }): EnableEligibility {
  if (!dog.sex) return { ok: false, reason: "SEX_REQUIRED" };
  return { ok: true };
}

export type DogSizeBucket = "small" | "medium" | "large";

/** Same thresholds as lib/constants/dog-sizes.ts, inlined to keep this module pure. */
export function sizeBucketFromWeight(weightKg: number | null | undefined): DogSizeBucket | null {
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (weightKg < 10) return "small";
  if (weightKg <= 25) return "medium";
  return "large";
}

/**
 * Informational only (léger gating): Swiss OPAn sets a bitch's minimum breeding
 * age around 15-18 months (size-dependent) up to ~8 years. DogProfile only
 * stores birth YEAR, so this is a coarse, non-blocking hint used to show a soft
 * notice — never to gate. Returns true when the dog plausibly looks of age.
 */
export function isBreedingAgeHint(birthYear: number | null | undefined, now: Date = new Date()): boolean {
  if (birthYear == null || !Number.isFinite(birthYear)) return true; // unknown → don't warn
  const ageYears = now.getFullYear() - birthYear;
  return ageYears >= 1 && ageYears <= 8;
}
