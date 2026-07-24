/**
 * Pure helpers for match creation. A Match stores a canonical, order-independent
 * pair so (A likes B) and (B likes A) resolve to the SAME row. No `@/` imports so
 * it runs under `node --test`.
 */

export type CanonicalPair = { dogAId: string; dogBId: string };

/** Order two mating-profile ids deterministically (smaller id first). */
export function canonicalPair(idA: string, idB: string): CanonicalPair {
  return idA < idB ? { dogAId: idA, dogBId: idB } : { dogAId: idB, dogBId: idA };
}

/**
 * A mutual match exists when the current swipe is a LIKE and the target has
 * already LIKED back. PASS never creates a match.
 */
export function isMutualMatch(
  currentDirection: "LIKE" | "PASS",
  reverseSwipe: { direction: "LIKE" | "PASS" } | null | undefined,
): boolean {
  return currentDirection === "LIKE" && reverseSwipe?.direction === "LIKE";
}
