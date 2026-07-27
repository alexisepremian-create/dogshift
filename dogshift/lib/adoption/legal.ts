// Swiss legal rules that gate an adoption listing.
//
// The point of this module: article 76d al. 2 OPAn puts the duty to ensure a
// dog-cession ad is complete on the OPERATOR of the platform — not on the
// person publishing it. So the completeness check has to live in our code and
// block publication, rather than be a nice-to-have form hint.
//
// Pure module (no imports) so `node --test` can run it directly.

/** OPAn art. 70 al. 4 — a puppy may not be separated from its mother earlier. */
export const MIN_SEPARATION_DAYS = 56;

/** OFE art. 16-18 — both parties declare the transfer to AMICUS within 10 days. */
export const AMICUS_DECLARATION_DAYS = 10;

/**
 * OPAn art. 76b (in force 01.02.2025) — importing or transiting a dog younger
 * than 15 weeks with the intent to transfer ownership is banned.
 */
export const MIN_IMPORT_AGE_WEEKS = 15;

/** OPAn art. 110 — no cession to a minor under 16 without parental consent. */
export const MIN_ADOPTER_AGE = 16;

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageInDays(birthDate: Date, now: Date): number {
  return Math.floor((now.getTime() - birthDate.getTime()) / DAY_MS);
}

export type SeparationCheck = {
  ok: boolean;
  daysOld: number;
  /** Earliest date the puppy may legally leave its mother. */
  eligibleFrom: Date;
  message: string | null;
};

/**
 * Can this dog legally be handed over today? Blocks the publication of puppies
 * that would be separated from the mother before 56 days.
 */
export function checkSeparationAge(birthDate: Date, now: Date): SeparationCheck {
  const daysOld = ageInDays(birthDate, now);
  const eligibleFrom = new Date(birthDate.getTime() + MIN_SEPARATION_DAYS * DAY_MS);
  if (daysOld >= MIN_SEPARATION_DAYS) {
    return { ok: true, daysOld, eligibleFrom, message: null };
  }
  return {
    ok: false,
    daysOld,
    eligibleFrom,
    message: `Un chiot ne peut pas être séparé de sa mère avant ${MIN_SEPARATION_DAYS} jours (art. 70 al. 4 OPAn). Ce chiot en a ${daysOld}.`,
  };
}

/**
 * ISO 11784 transponder: 15 digits. Swiss-registered chips start with the
 * country code 756, but imported dogs legitimately carry a foreign code — so
 * the prefix is informative, never a rejection.
 */
export function isValidMicrochipNumber(value: string): boolean {
  return /^\d{15}$/.test(value.trim());
}

export function isSwissMicrochip(value: string): boolean {
  return isValidMicrochipNumber(value) && value.trim().startsWith("756");
}

export type ListingLegalInput = {
  microchipNumber?: string | null;
  provenance?: string | null;
  breedingCountry?: string | null;
  cedantFullName?: string | null;
  cedantAddress?: string | null;
  cedantPostalCode?: string | null;
  cedantCity?: string | null;
  birthDate?: Date | null;
  photos?: string[] | null;
  description?: string | null;
};

export type LegalIssue = { field: string; message: string };

/**
 * Article 76d al. 1 OPAn completeness check, plus the two hard blocks (56-day
 * rule, missing chip). Called before flipping a listing to PUBLISHED.
 *
 * Everything returned here is blocking. Soft nudges (cantonal course, RC
 * insurance, breed restrictions) live in their own modules and never block.
 */
export function checkListingLegality(input: ListingLegalInput, now: Date): { ok: boolean; issues: LegalIssue[] } {
  const issues: LegalIssue[] = [];
  const text = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");

  // — art. 76d al. 1 : identity of the cédant —
  if (text(input.cedantFullName).length < 3) {
    issues.push({ field: "cedantFullName", message: "Le prénom et le nom du cédant sont obligatoires (art. 76d OPAn)." });
  }
  if (text(input.cedantAddress).length < 3) {
    issues.push({ field: "cedantAddress", message: "L'adresse du cédant est obligatoire (art. 76d OPAn)." });
  }
  if (!/^\d{4}$/.test(text(input.cedantPostalCode))) {
    issues.push({ field: "cedantPostalCode", message: "Le NPA du cédant est obligatoire (4 chiffres)." });
  }
  if (text(input.cedantCity).length < 2) {
    issues.push({ field: "cedantCity", message: "La localité du cédant est obligatoire (art. 76d OPAn)." });
  }

  // — art. 76d al. 1 : provenance + country of breeding —
  if (!text(input.provenance)) {
    issues.push({ field: "provenance", message: "La provenance du chien est obligatoire (art. 76d OPAn)." });
  }
  if (!/^[A-Z]{2}$/.test(text(input.breedingCountry))) {
    issues.push({ field: "breedingCountry", message: "Le pays d'élevage est obligatoire (art. 76d OPAn)." });
  }

  // — AMICUS : the dog must be chipped before any cession —
  const chip = text(input.microchipNumber);
  if (!chip) {
    issues.push({ field: "microchipNumber", message: "Le numéro de puce AMICUS est obligatoire : un chien doit être identifié avant toute cession." });
  } else if (!isValidMicrochipNumber(chip)) {
    issues.push({ field: "microchipNumber", message: "Le numéro de puce doit comporter 15 chiffres." });
  }

  // — art. 70 al. 4 : 56-day separation —
  if (!input.birthDate) {
    issues.push({ field: "birthDate", message: "La date de naissance du chien est obligatoire." });
  } else {
    const sep = checkSeparationAge(input.birthDate, now);
    if (!sep.ok && sep.message) issues.push({ field: "birthDate", message: sep.message });
  }

  // — platform quality floor —
  if (!input.photos || input.photos.length < 1) {
    issues.push({ field: "photos", message: "Au moins une photo du chien est requise." });
  }
  if (text(input.description).length < 40) {
    issues.push({ field: "description", message: "Décris le chien en quelques phrases (40 caractères minimum)." });
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Money wording. DogShift never says "prix" — refuges deliberately use
 * "participation aux frais" so the cession isn't requalified as a sale (which
 * would drag in the CO art. 197 ss warranty for defects).
 */
export function formatAdoptionFee(centimes: number): string {
  if (!Number.isFinite(centimes) || centimes <= 0) return "Gratuit";
  const chf = centimes / 100;
  const formatted = Number.isInteger(chf) ? `${chf}.–` : chf.toFixed(2);
  return `CHF ${formatted} de participation aux frais`;
}

/** Deadline by which both parties must declare the transfer to AMICUS. */
export function amicusDeadline(cessionDate: Date): Date {
  return new Date(cessionDate.getTime() + AMICUS_DECLARATION_DAYS * DAY_MS);
}
