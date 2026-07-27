// Swiss canton reference data for the adoption feature.
// Pure data + helpers — no imports, so `node --test` can run this directly.

export type CantonCode =
  | "AG" | "AI" | "AR" | "BE" | "BL" | "BS" | "FR" | "GE" | "GL" | "GR"
  | "JU" | "LU" | "NE" | "NW" | "OW" | "SG" | "SH" | "SO" | "SZ" | "TG"
  | "TI" | "UR" | "VD" | "VS" | "ZG" | "ZH";

export const CANTONS: ReadonlyArray<{ code: CantonCode; name: string }> = [
  { code: "AG", name: "Argovie" },
  { code: "AI", name: "Appenzell Rhodes-Intérieures" },
  { code: "AR", name: "Appenzell Rhodes-Extérieures" },
  { code: "BE", name: "Berne" },
  { code: "BL", name: "Bâle-Campagne" },
  { code: "BS", name: "Bâle-Ville" },
  { code: "FR", name: "Fribourg" },
  { code: "GE", name: "Genève" },
  { code: "GL", name: "Glaris" },
  { code: "GR", name: "Grisons" },
  { code: "JU", name: "Jura" },
  { code: "LU", name: "Lucerne" },
  { code: "NE", name: "Neuchâtel" },
  { code: "NW", name: "Nidwald" },
  { code: "OW", name: "Obwald" },
  { code: "SG", name: "Saint-Gall" },
  { code: "SH", name: "Schaffhouse" },
  { code: "SO", name: "Soleure" },
  { code: "SZ", name: "Schwytz" },
  { code: "TG", name: "Thurgovie" },
  { code: "TI", name: "Tessin" },
  { code: "UR", name: "Uri" },
  { code: "VD", name: "Vaud" },
  { code: "VS", name: "Valais" },
  { code: "ZG", name: "Zoug" },
  { code: "ZH", name: "Zurich" },
];

const CANTON_CODES = new Set(CANTONS.map((c) => c.code));

export function isCantonCode(value: string): value is CantonCode {
  return CANTON_CODES.has(value as CantonCode);
}

export function cantonName(code: string): string {
  return CANTONS.find((c) => c.code === code)?.name ?? code;
}

/**
 * Cantons that require a dog-owner course (théorie et/ou pratique) before or
 * shortly after acquiring a dog. We surface this as a reminder to the adopter,
 * never as a block — the requirement lands on them after the cession, and the
 * detail (who is exempt, what deadline) is cantonal.
 */
export const COURSE_REQUIRED_CANTONS: ReadonlyArray<{ code: CantonCode; detail: string }> = [
  { code: "NE", detail: "Cours obligatoire pour tout nouveau détenteur (depuis 2021)." },
  { code: "VS", detail: "Cours obligatoire pour tout nouveau détenteur (depuis 2020)." },
  { code: "FR", detail: "5 h de théorie avant l'acquisition, puis une partie pratique dans les 18 mois (depuis 2024)." },
  { code: "GE", detail: "Cours obligatoire pour les chiens de grande taille et les races listées." },
];

/**
 * Cantons where a third-party liability insurance (RC) is mandatory for dog
 * owners. The list is stable but cantonal law moves — treat it as a reminder,
 * not as a compliance guarantee.
 */
export const RC_INSURANCE_CANTONS: ReadonlyArray<CantonCode> = [
  "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "SG", "SH", "SO", "SZ", "TG", "TI", "ZH",
];

export function requiresOwnerCourse(canton: string): { required: boolean; detail: string | null } {
  const hit = COURSE_REQUIRED_CANTONS.find((c) => c.code === canton);
  return { required: Boolean(hit), detail: hit?.detail ?? null };
}

export function requiresLiabilityInsurance(canton: string): boolean {
  return (RC_INSURANCE_CANTONS as ReadonlyArray<string>).includes(canton);
}
