// Cantonal breed restrictions ("chiens dits dangereux"), as of 2026.
//
// Swiss dog law is cantonal: the same dog can be freely adopted in Berne,
// require an authorisation in Vaud, and be flat-out banned in Geneva. An
// adoption platform that ignores this actively pushes people into an illegal
// acquisition — so we check the adopter's canton against the listing's breed
// and surface the answer BEFORE they apply.
//
// This is a decision-support tool, not legal advice: cantonal lists change and
// the authorities are the only authority. `RESTRICTIONS_REVIEWED_ON` says how
// fresh the data is; the UI must show it.
//
// Pure module (no imports) so `node --test` can run it directly.

export type RestrictionLevel = "NONE" | "PERMIT_REQUIRED" | "BANNED";

export const RESTRICTIONS_REVIEWED_ON = "2026-07-27";

/**
 * Canonical breed keys. Cantonal lists all describe the same handful of
 * "molossoïdes / terriers de type bull" — we normalise to these keys so a
 * listing typed "Am Staff" or "American staffordshire-terrier" still matches.
 */
type BreedKey =
  | "american_staffordshire_terrier"
  | "american_pit_bull_terrier"
  | "staffordshire_bull_terrier"
  | "bull_terrier"
  | "rottweiler"
  | "dobermann"
  | "mastiff"
  | "tosa"
  | "cane_corso"
  | "dogue_argentin"
  | "fila_brasileiro"
  | "dogue_de_bordeaux";

/** Lowercase, accent-free, punctuation-free tokens that identify each breed. */
const BREED_ALIASES: ReadonlyArray<{ key: BreedKey; patterns: string[] }> = [
  {
    key: "american_staffordshire_terrier",
    patterns: ["american staffordshire", "americain staffordshire", "amstaff", "am staff", "staffordshire americain"],
  },
  {
    key: "american_pit_bull_terrier",
    patterns: ["pit bull", "pitbull", "american pit", "american bull terrier"],
  },
  {
    key: "staffordshire_bull_terrier",
    patterns: ["staffordshire bull terrier", "staffie", "staffy"],
  },
  { key: "bull_terrier", patterns: ["bull terrier", "bullterrier"] },
  { key: "rottweiler", patterns: ["rottweiler", "rottweil"] },
  { key: "dobermann", patterns: ["dobermann", "doberman"] },
  { key: "mastiff", patterns: ["mastiff", "mastin", "bullmastiff"] },
  { key: "tosa", patterns: ["tosa"] },
  { key: "cane_corso", patterns: ["cane corso"] },
  { key: "dogue_argentin", patterns: ["dogue argentin", "dogo argentino"] },
  { key: "fila_brasileiro", patterns: ["fila brasileiro", "fila bresilien"] },
  { key: "dogue_de_bordeaux", patterns: ["dogue de bordeaux"] },
];

type CantonRule = {
  banned: BreedKey[];
  permitRequired: BreedKey[];
  /** Crossbreeds of a listed breed are covered by the same rule. */
  coversCrossbreeds: boolean;
  source: string;
};

const CANTON_RULES: Readonly<Record<string, CantonRule>> = {
  GE: {
    banned: [
      "american_staffordshire_terrier",
      "american_pit_bull_terrier",
      "rottweiler",
      "dogue_de_bordeaux",
      "mastiff",
      "tosa",
      "cane_corso",
      "dogue_argentin",
      "fila_brasileiro",
    ],
    permitRequired: [],
    coversCrossbreeds: true,
    source: "Loi genevoise sur les chiens (LChiens) — races interdites d'acquisition",
  },
  VS: {
    banned: [
      "american_staffordshire_terrier",
      "american_pit_bull_terrier",
      "staffordshire_bull_terrier",
      "bull_terrier",
      "dobermann",
      "rottweiler",
      "mastiff",
      "dogue_argentin",
      "fila_brasileiro",
      "tosa",
    ],
    permitRequired: [],
    coversCrossbreeds: true,
    source: "Loi valaisanne sur la protection des animaux — races interdites",
  },
  ZH: {
    banned: [
      "american_staffordshire_terrier",
      "american_pit_bull_terrier",
      "staffordshire_bull_terrier",
      "bull_terrier",
      "rottweiler",
    ],
    permitRequired: [],
    coversCrossbreeds: true,
    source: "Hundegesetz ZH — Rasseverbot (interdiction d'acquisition, depuis le 01.01.2025)",
  },
  FR: {
    banned: ["american_pit_bull_terrier"],
    permitRequired: [],
    coversCrossbreeds: true,
    source: "Loi fribourgeoise sur la détention des chiens (depuis le 01.01.2024)",
  },
  VD: {
    banned: [],
    permitRequired: ["american_staffordshire_terrier", "american_pit_bull_terrier", "rottweiler"],
    coversCrossbreeds: true,
    source: "Loi vaudoise sur la police des chiens (LPolC) — autorisation cantonale",
  },
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Every restricted-breed key the free-text breed field matches. */
export function matchBreedKeys(...breeds: Array<string | null | undefined>): string[] {
  const haystack = breeds.filter(Boolean).map((b) => normalize(String(b))).join(" | ");
  if (!haystack) return [];
  const hits: string[] = [];
  for (const { key, patterns } of BREED_ALIASES) {
    if (patterns.some((p) => haystack.includes(p))) hits.push(key);
  }
  return hits;
}

export type BreedRestriction = {
  level: RestrictionLevel;
  /** Human-readable French message for the adopter. Empty when level is NONE. */
  message: string;
  source: string | null;
  reviewedOn: string;
};

/**
 * Restriction that applies when a dog of `breed` is adopted into `canton`.
 *
 * `isCrossbreed` matters because every cantonal list explicitly extends to
 * "croisements" — a "croisé Am Staff" is treated exactly like an Am Staff.
 */
export function checkBreedRestriction(input: {
  canton: string;
  breed?: string | null;
  secondaryBreed?: string | null;
  isCrossbreed?: boolean;
}): BreedRestriction {
  const rule = CANTON_RULES[input.canton];
  const base = { source: rule?.source ?? null, reviewedOn: RESTRICTIONS_REVIEWED_ON };
  if (!rule) return { level: "NONE", message: "", ...base, source: null };

  const keys = matchBreedKeys(input.breed, input.secondaryBreed);
  if (keys.length === 0) return { level: "NONE", message: "", ...base, source: null };

  // A crossbreed of a listed breed is still covered — unless the canton says
  // otherwise, which none currently does.
  if (input.isCrossbreed && !rule.coversCrossbreeds) {
    return { level: "NONE", message: "", ...base, source: null };
  }

  const banned = keys.filter((k) => (rule.banned as string[]).includes(k));
  if (banned.length > 0) {
    return {
      level: "BANNED",
      message: `Cette race est interdite dans le canton ${input.canton}. Une adoption y serait illégale, y compris pour un croisement.`,
      ...base,
    };
  }

  const permit = keys.filter((k) => (rule.permitRequired as string[]).includes(k));
  if (permit.length > 0) {
    return {
      level: "PERMIT_REQUIRED",
      message: `Cette race nécessite une autorisation du vétérinaire cantonal dans le canton ${input.canton}. Demande-la avant d'adopter.`,
      ...base,
    };
  }

  return { level: "NONE", message: "", ...base, source: null };
}
