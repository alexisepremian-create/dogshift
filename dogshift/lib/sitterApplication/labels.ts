/**
 * Helpers to turn the compact slugs we store in DB into human-readable French
 * labels for the admin panel.
 *
 * Why not inline everything in the component? Because the n8n scoring node and
 * future re-scoring tooling may need the same mapping server-side without
 * pulling the whole React admin module.
 */

import {
  DOG_SIZE_OPTIONS,
  GARDE_EXPERIENCE_LEVEL_OPTIONS,
  GARDE_TYPE_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  LINK_ANIMAL_PROFESSION_OPTIONS,
} from "./options.ts";

function buildLabelMap<T extends { value: string; label: string }>(
  options: readonly T[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const opt of options) {
    map[opt.value] = opt.label;
  }
  return map;
}

const LINK_ANIMAL_PROFESSION_LABELS = buildLabelMap(LINK_ANIMAL_PROFESSION_OPTIONS);
const GARDE_EXPERIENCE_LEVEL_LABELS = buildLabelMap(GARDE_EXPERIENCE_LEVEL_OPTIONS);
const GARDE_TYPE_LABELS = buildLabelMap(GARDE_TYPE_OPTIONS);
const DOG_SIZE_LABELS = buildLabelMap(DOG_SIZE_OPTIONS);
const HOUSING_TYPE_LABELS = buildLabelMap(HOUSING_TYPE_OPTIONS);

export function labelForLinkAnimalProfession(value: string | null | undefined): string | null {
  if (!value) return null;
  return LINK_ANIMAL_PROFESSION_LABELS[value] ?? value;
}

export function labelForGardeExperienceLevel(value: string | null | undefined): string | null {
  if (!value) return null;
  return GARDE_EXPERIENCE_LEVEL_LABELS[value] ?? value;
}

export function labelForGardeType(value: string): string {
  return GARDE_TYPE_LABELS[value] ?? value;
}

export function labelForDogSize(value: string): string {
  return DOG_SIZE_LABELS[value] ?? value;
}

export function labelForHousingType(value: string | null | undefined): string | null {
  if (!value) return null;
  return HOUSING_TYPE_LABELS[value] ?? value;
}

// ---------------------------------------------------------------------------
// Availability grid — pretty-printing
// ---------------------------------------------------------------------------

export type DaySlotsShape = {
  matin?: boolean;
  apresMidi?: boolean;
  journeeEntiere?: boolean;
};

const DAY_ORDER = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

const DAY_SHORT_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  lundi: "Lun",
  mardi: "Mar",
  mercredi: "Mer",
  jeudi: "Jeu",
  vendredi: "Ven",
  samedi: "Sam",
  dimanche: "Dim",
};

export function describeAvailabilitySlot(slot: DaySlotsShape | null | undefined): string {
  if (!slot) return "—";
  if (slot.journeeEntiere) return "Journée entière";
  const parts: string[] = [];
  if (slot.matin) parts.push("Matin");
  if (slot.apresMidi) parts.push("Après-midi");
  if (parts.length === 0) return "—";
  return parts.join(" + ");
}

export function availabilityToRows(
  grid: Record<string, DaySlotsShape> | null | undefined,
): Array<{ day: string; shortLabel: string; description: string; hasSlot: boolean }> {
  return DAY_ORDER.map((day) => {
    const slot = grid?.[day];
    const hasSlot = Boolean(slot?.matin || slot?.apresMidi || slot?.journeeEntiere);
    return {
      day,
      shortLabel: DAY_SHORT_LABELS[day],
      description: describeAvailabilitySlot(slot),
      hasSlot,
    };
  });
}

// ---------------------------------------------------------------------------
// Other animals — flatten the checkbox record into a human-readable list
// ---------------------------------------------------------------------------

export type OtherAnimalsShape = {
  none?: boolean;
  dogs?: boolean;
  cats?: boolean;
  others?: boolean;
};

export function describeOtherAnimals(
  value: OtherAnimalsShape | null | undefined,
  dogCount?: number | null,
): string {
  if (!value) return "—";
  if (value.none) return "Aucun";
  const parts: string[] = [];
  if (value.dogs) {
    parts.push(dogCount && dogCount > 0 ? `Chien(s) (${dogCount})` : "Chien(s)");
  }
  if (value.cats) parts.push("Chat(s)");
  if (value.others) parts.push("Autres (NAC, oiseaux, rongeurs…)");
  return parts.length ? parts.join(", ") : "—";
}
