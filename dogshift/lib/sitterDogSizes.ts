/**
 * Canonical resolution of a sitter's accepted dog sizes for PUBLIC consumers
 * (search filter, sitter cards, map).
 *
 * Why this exists: a sitter's accepted sizes are stored TWICE and can drift:
 *   1. `acceptsSmall/acceptsMedium/acceptsLarge` (Boolean columns, the "capacity
 *      model") — what the sitter toggles in `SizeAcceptanceToggle` and what the
 *      booking flow ENFORCES via `isSizeAccepted` (lib/bookings/capacityCheck.ts).
 *      => This is the source of truth.
 *   2. `SitterProfile.dogSizes` (Json) — a legacy/derived field. It can hold a
 *      FR-label array `["Petit","Moyen"]`, an object `{ Petit: true, ... }`, or
 *      (from the application form) EN codes `["small","medium","large"]`. It is
 *      only loosely kept in sync.
 *
 * The search filter used to read (2) directly, so results didn't match what the
 * sitter actually accepts (and what a booking would allow). This resolver makes
 * search/display authoritative by deriving from (1), falling back to (2) only
 * when the capacity booleans are absent (legacy rows / pre-migration DB).
 */
export type DogSizeLabel = "Petit" | "Moyen" | "Grand";

const ORDER: readonly DogSizeLabel[] = ["Petit", "Moyen", "Grand"];

function labelFor(token: unknown): DogSizeLabel | null {
  if (token === "Petit" || token === "small" || token === "petit") return "Petit";
  if (token === "Moyen" || token === "medium" || token === "moyen") return "Moyen";
  if (token === "Grand" || token === "large" || token === "grand") return "Grand";
  return null;
}

/** Parse the legacy `dogSizes` JSON (FR labels array, EN codes array, or boolean record). */
export function parseLegacyDogSizes(value: unknown): DogSizeLabel[] {
  const found = new Set<DogSizeLabel>();
  if (Array.isArray(value)) {
    for (const v of value) {
      const label = labelFor(v);
      if (label) found.add(label);
    }
  } else if (value && typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === true) {
        const label = labelFor(key);
        if (label) found.add(label);
      }
    }
  }
  return ORDER.filter((s) => found.has(s));
}

/**
 * Resolve the authoritative accepted-size labels for a sitter. Prefers the
 * capacity booleans; falls back to the legacy `dogSizes` JSON when none of the
 * booleans is a real boolean (e.g. capacity columns missing).
 */
export function resolveSitterDogSizes(input: {
  acceptsSmall?: boolean | null;
  acceptsMedium?: boolean | null;
  acceptsLarge?: boolean | null;
  dogSizesJson?: unknown;
}): DogSizeLabel[] {
  const { acceptsSmall, acceptsMedium, acceptsLarge, dogSizesJson } = input;

  const hasCapacityModel =
    typeof acceptsSmall === "boolean" ||
    typeof acceptsMedium === "boolean" ||
    typeof acceptsLarge === "boolean";

  if (hasCapacityModel) {
    const out: DogSizeLabel[] = [];
    // When the capacity model is present, all three columns are real booleans
    // (DB defaults to true), so `!== false` means "accepted".
    if (acceptsSmall !== false) out.push("Petit");
    if (acceptsMedium !== false) out.push("Moyen");
    if (acceptsLarge !== false) out.push("Grand");
    return out;
  }

  return parseLegacyDogSizes(dogSizesJson);
}
