// Shared option sets for the sitter pilot application form.
// Values stored in DB are stable machine-readable slugs. Labels are shown to
// users and also reused by the admin UI if it later wants to render them.

// ----------------------------------------------------------------------------
// Cities (Lausanne + Riviera vaudoise pilot zone)
// ----------------------------------------------------------------------------
export const TARGET_CITIES = [
  "Lausanne",
  "Renens",
  "Prilly",
  "Ecublens",
  "Crissier",
  "Chavannes-près-Renens",
  "Bussigny",
  "Epalinges",
  "Le Mont-sur-Lausanne",
  "Pully",
  "Lutry",
  "Cully",
  "Chexbres",
  "Vevey",
  "La Tour-de-Peilz",
  "Corsier-sur-Vevey",
  "St-Légier",
  "Blonay",
  "Montreux",
  "Clarens",
  "Territet",
] as const;

export const CITY_OTHER_VALUE = "Autre";
export const CITY_VALUES = [...TARGET_CITIES, CITY_OTHER_VALUE] as const;
export type CityValue = (typeof CITY_VALUES)[number];

// ----------------------------------------------------------------------------
// Link with animal profession
// ----------------------------------------------------------------------------
export const LINK_ANIMAL_PROFESSION_OPTIONS = [
  { value: "none", label: "Aucun (passion personnelle uniquement)" },
  { value: "veterinarian", label: "Vétérinaire / médecin vétérinaire" },
  { value: "asa", label: "ASA (assistant·e en soins vétérinaires)" },
  { value: "breeder", label: "Éleveur / éleveuse" },
  { value: "groomer", label: "Toiletteur / toiletteuse" },
  { value: "trainer", label: "Éducateur / dresseur canin" },
  { value: "handler", label: "Maître-chien / agent cynophile" },
  { value: "behaviorist", label: "Comportementaliste canin" },
  { value: "shelter_volunteer", label: "Bénévole en refuge / SPA" },
  { value: "other", label: "Autre métier animalier" },
] as const;

export const LINK_ANIMAL_PROFESSION_VALUES =
  LINK_ANIMAL_PROFESSION_OPTIONS.map((o) => o.value) as readonly (typeof LINK_ANIMAL_PROFESSION_OPTIONS)[number]["value"][];

// ----------------------------------------------------------------------------
// Dog-sitting experience level
// ----------------------------------------------------------------------------
export const GARDE_EXPERIENCE_LEVEL_OPTIONS = [
  { value: "never", label: "Jamais" },
  { value: "occasional_family", label: "Occasionnellement (famille / amis)" },
  { value: "regular_lt_1y", label: "Régulièrement, moins de 1 an" },
  { value: "regular_1_3y", label: "Régulièrement, 1 à 3 ans" },
  { value: "extensive_3y_plus", label: "Beaucoup d'expérience (3 ans et plus)" },
  { value: "professional", label: "Expérience professionnelle" },
] as const;

export const GARDE_EXPERIENCE_LEVEL_VALUES =
  GARDE_EXPERIENCE_LEVEL_OPTIONS.map((o) => o.value) as readonly (typeof GARDE_EXPERIENCE_LEVEL_OPTIONS)[number]["value"][];

// ----------------------------------------------------------------------------
// Sitting types offered
// ----------------------------------------------------------------------------
// Kept aligned with the 3 services publicly offered on the platform:
// promenade, dogsitting (half / full day), pension (multi-day boarding).
// Historical values (at_my_home, home_visits, overnight, at_owner_home) are
// still accepted at the API / DB layer for legacy rows but are no longer
// surfaced in the form.
export const GARDE_TYPE_OPTIONS = [
  { value: "walks_only", label: "Promenade" },
  { value: "at_owner_home", label: "Dogsitting (garde à la journée)" },
  { value: "at_my_home", label: "Pension (garde sur plusieurs jours à mon domicile)" },
] as const;

export const GARDE_TYPE_VALUES =
  GARDE_TYPE_OPTIONS.map((o) => o.value) as readonly (typeof GARDE_TYPE_OPTIONS)[number]["value"][];

// ----------------------------------------------------------------------------
// Accepted dog sizes
// ----------------------------------------------------------------------------
// Aligned with the 3 size buckets exposed on the public sitter search.
// Historical `xl` value is still accepted at the DB layer for legacy rows but
// is no longer offered in the form.
export const DOG_SIZE_OPTIONS = [
  { value: "small", label: "Petit (< 10 kg)" },
  { value: "medium", label: "Moyen (10-25 kg)" },
  { value: "large", label: "Grand (> 25 kg)" },
] as const;

export const DOG_SIZE_VALUES =
  DOG_SIZE_OPTIONS.map((o) => o.value) as readonly (typeof DOG_SIZE_OPTIONS)[number]["value"][];

// ----------------------------------------------------------------------------
// Housing type
// ----------------------------------------------------------------------------
export const HOUSING_TYPE_OPTIONS = [
  { value: "apartment_with_outdoor", label: "Appartement avec balcon / terrasse" },
  { value: "apartment_no_outdoor", label: "Appartement sans extérieur" },
  { value: "house_with_garden", label: "Maison avec jardin" },
  { value: "house_no_garden", label: "Maison sans jardin" },
  { value: "other", label: "Autre" },
] as const;

export const HOUSING_TYPE_VALUES =
  HOUSING_TYPE_OPTIONS.map((o) => o.value) as readonly (typeof HOUSING_TYPE_OPTIONS)[number]["value"][];

// ----------------------------------------------------------------------------
// Other animals at home
// ----------------------------------------------------------------------------
export const OTHER_ANIMAL_KEYS = ["none", "dogs", "cats", "others"] as const;
export type OtherAnimalKey = (typeof OTHER_ANIMAL_KEYS)[number];

export const OTHER_ANIMAL_OPTIONS: Array<{ value: OtherAnimalKey; label: string }> = [
  { value: "none", label: "Aucun" },
  { value: "dogs", label: "Chien(s)" },
  { value: "cats", label: "Chat(s)" },
  { value: "others", label: "Autres (NAC, oiseaux, rongeurs…)" },
];

// ----------------------------------------------------------------------------
// Availability grid
// ----------------------------------------------------------------------------
export const DAY_KEYS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
  dimanche: "Dimanche",
};

export type DaySlots = {
  matin: boolean;
  apresMidi: boolean;
  journeeEntiere: boolean;
};

export type AvailabilityGridValue = Record<DayKey, DaySlots>;

export function emptyAvailabilityGrid(): AvailabilityGridValue {
  return {
    lundi: { matin: false, apresMidi: false, journeeEntiere: false },
    mardi: { matin: false, apresMidi: false, journeeEntiere: false },
    mercredi: { matin: false, apresMidi: false, journeeEntiere: false },
    jeudi: { matin: false, apresMidi: false, journeeEntiere: false },
    vendredi: { matin: false, apresMidi: false, journeeEntiere: false },
    samedi: { matin: false, apresMidi: false, journeeEntiere: false },
    dimanche: { matin: false, apresMidi: false, journeeEntiere: false },
  };
}

export function hasAnyAvailabilitySlot(grid: AvailabilityGridValue): boolean {
  return DAY_KEYS.some((d) => {
    const slot = grid[d];
    return slot.matin || slot.apresMidi || slot.journeeEntiere;
  });
}

export function countFullDays(grid: AvailabilityGridValue): number {
  return DAY_KEYS.reduce((n, d) => n + (grid[d].journeeEntiere ? 1 : 0), 0);
}

// ----------------------------------------------------------------------------
// Phone normalisation helpers
// ----------------------------------------------------------------------------

/**
 * Normalize a raw phone string to the strict Swiss format `+41[0-9]{9}`.
 *
 *  - Strips all non-digit / non-plus characters.
 *  - Accepts `0041...`, `0XX...` (Swiss national), and already-prefixed
 *    `+41...` forms.
 *  - Returns the normalized string (may still be invalid — validate after).
 */
export function normalizeSwissPhone(raw: string): string {
  if (!raw) return "";
  let v = raw.trim().replace(/[^\d+]/g, "");

  // Handle 00XX international prefix -> +XX
  if (v.startsWith("00")) v = `+${v.slice(2)}`;

  // Swiss national format (starts with 0 and has 10 digits total) -> +41 + 9 digits
  if (v.startsWith("0") && !v.startsWith("00") && /^0\d{9}$/.test(v)) {
    v = `+41${v.slice(1)}`;
  }

  return v;
}

export const SWISS_PHONE_REGEX = /^\+41[0-9]{9}$/;

export function isValidSwissPhone(value: string): boolean {
  return SWISS_PHONE_REGEX.test(value);
}

/**
 * Format `+41791234567` as `+41 79 123 45 67` for display / masked typing.
 * Partial inputs produce partial formatting (keeps caret UX tolerable).
 */
export function formatSwissPhoneDisplay(value: string): string {
  const v = (value ?? "").trim();
  if (!v.startsWith("+41")) return v;
  const digits = v.slice(3).replace(/\D/g, "");
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter((p) => p.length > 0);
  return parts.length === 0 ? "+41" : `+41 ${parts.join(" ")}`;
}

// ----------------------------------------------------------------------------
// Swiss postal code (NPA) – 4 digits
// ----------------------------------------------------------------------------
export const SWISS_NPA_REGEX = /^[1-9][0-9]{3}$/;
