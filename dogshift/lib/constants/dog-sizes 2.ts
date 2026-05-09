export const DOG_SIZE_WEIGHTS = {
  small: { weight: 1, label: "Petit", range: "< 10 kg" },
  medium: { weight: 2, label: "Moyen", range: "10–25 kg" },
  large: { weight: 3, label: "Grand", range: "> 25 kg" },
} as const;

export type DogSizeKey = keyof typeof DOG_SIZE_WEIGHTS;

export const DOG_SIZE_KEYS: readonly DogSizeKey[] = ["small", "medium", "large"] as const;

export const MAX_CAPACITY_PLACES = 15;
export const DEFAULT_CAPACITY_PLACES = 3;

export function slotsUsed(size: DogSizeKey): number {
  return DOG_SIZE_WEIGHTS[size].weight;
}

/**
 * Compute weighted capacity from per-size counts (for migration from old model).
 * Clamps to MAX_CAPACITY_PLACES.
 */
export function computeCapacityFromCounts(counts: Partial<Record<DogSizeKey, number>>): number {
  const raw =
    (counts.small ?? 0) * DOG_SIZE_WEIGHTS.small.weight +
    (counts.medium ?? 0) * DOG_SIZE_WEIGHTS.medium.weight +
    (counts.large ?? 0) * DOG_SIZE_WEIGHTS.large.weight;
  return Math.min(Math.max(raw, 1), MAX_CAPACITY_PLACES);
}

/**
 * Generate example combination scenarios given a total capacity and enabled sizes.
 * Returns up to `maxScenarios` combinations, each as a Record<DogSizeKey, number>.
 */
export function generateCapacityScenarios(
  totalPlaces: number,
  enabledSizes: DogSizeKey[],
  maxScenarios = 5,
): Array<Record<DogSizeKey, number>> {
  if (enabledSizes.length === 0 || totalPlaces <= 0) return [];

  const sorted = [...enabledSizes].sort(
    (a, b) => DOG_SIZE_WEIGHTS[a].weight - DOG_SIZE_WEIGHTS[b].weight,
  );

  const scenarios: Array<Record<DogSizeKey, number>> = [];
  const seen = new Set<string>();

  const addIfNew = (combo: Record<DogSizeKey, number>) => {
    const key = DOG_SIZE_KEYS.map((k) => combo[k] ?? 0).join(",");
    if (seen.has(key)) return;
    seen.add(key);
    scenarios.push({ ...combo });
  };

  // Mono-size scenarios: fill entirely with one size
  for (const size of sorted) {
    const w = DOG_SIZE_WEIGHTS[size].weight;
    const count = Math.floor(totalPlaces / w);
    if (count > 0) {
      const combo: Record<DogSizeKey, number> = { small: 0, medium: 0, large: 0 };
      combo[size] = count;
      addIfNew(combo);
    }
  }

  // Mixed scenarios: try combinations of 2+ sizes
  if (sorted.length >= 2) {
    for (let i = sorted.length - 1; i >= 0 && scenarios.length < maxScenarios * 2; i--) {
      const bigSize = sorted[i];
      const bigW = DOG_SIZE_WEIGHTS[bigSize].weight;
      for (let bigCount = 1; bigCount * bigW < totalPlaces; bigCount++) {
        const remaining = totalPlaces - bigCount * bigW;
        for (const fillSize of sorted) {
          if (fillSize === bigSize) continue;
          const fillW = DOG_SIZE_WEIGHTS[fillSize].weight;
          const fillCount = Math.floor(remaining / fillW);
          if (fillCount > 0) {
            const used = bigCount * bigW + fillCount * fillW;
            if (used <= totalPlaces) {
              const combo: Record<DogSizeKey, number> = { small: 0, medium: 0, large: 0 };
              combo[bigSize] = bigCount;
              combo[fillSize] = fillCount;
              addIfNew(combo);
            }
          }
        }
      }
    }
  }

  // Prioritize: mono-size first, then mixed, limit to maxScenarios
  return scenarios.slice(0, maxScenarios);
}
