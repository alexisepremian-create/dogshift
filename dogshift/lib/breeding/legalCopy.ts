/**
 * French (tutoiement) copy + constants for the breeding-match feature. Light
 * legal gating per founder: one disclaimer + one acceptance checkbox.
 */

export const BREEDING_DISCLAIMER =
  "DogShift met en relation des propriétaires pour un élevage privé et responsable. " +
  "La plateforme n'est pas un éleveur et ne vérifie pas les informations. Tu restes " +
  "responsable du respect de la loi suisse (LPA/OPAn) : chien pucé et enregistré AMICUS, " +
  "en âge et en bonne santé, élevage privé (≤ 3 portées/an ; un élevage commercial exige " +
  "une autorisation cantonale).";

export const BREEDING_ACCEPT_LABEL =
  "Je confirme respecter la loi suisse et que mon chien remplit ces conditions.";

/** Breeds where Swiss Qualzucht rules are most sensitive — non-blocking notice. */
const QUALZUCHT_BREEDS = [
  "bouledogue",
  "bulldog",
  "carlin",
  "pug",
  "cavalier",
  "shar",
  "pékinois",
  "pekinois",
  "boston",
  "chihuahua",
];

export function qualzuchtNotice(breed: string | null | undefined): string | null {
  if (!breed) return null;
  const b = breed.toLowerCase();
  if (QUALZUCHT_BREEDS.some((k) => b.includes(k))) {
    return "Cette race est sensible aux critères suisses de bien-être (Qualzucht). Élève de façon responsable, sans traits extrêmes.";
  }
  return null;
}

export const MATING_GOAL_LABELS: Record<"LITTER" | "STUD" | "EXPLORING", string> = {
  LITTER: "Faire une portée",
  STUD: "Proposer mon mâle (saillie)",
  EXPLORING: "Je découvre",
};

/** Swiss cantons (region filter — v1 distance proxy). */
export const SWISS_CANTONS = [
  "Vaud",
  "Genève",
  "Valais",
  "Fribourg",
  "Neuchâtel",
  "Jura",
  "Berne",
  "Zurich",
  "Argovie",
  "Lucerne",
  "Tessin",
  "Bâle-Ville",
  "Bâle-Campagne",
  "Soleure",
  "Schaffhouse",
  "Thurgovie",
  "Saint-Gall",
  "Grisons",
  "Zoug",
  "Schwytz",
  "Uri",
  "Obwald",
  "Nidwald",
  "Glaris",
  "Appenzell RE",
  "Appenzell RI",
] as const;
