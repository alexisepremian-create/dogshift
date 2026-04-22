import { z } from "zod";

import {
  CITY_VALUES,
  CITY_OTHER_VALUE,
  DAY_KEYS,
  DOG_SIZE_VALUES,
  GARDE_EXPERIENCE_LEVEL_VALUES,
  GARDE_TYPE_VALUES,
  HOUSING_TYPE_VALUES,
  LINK_ANIMAL_PROFESSION_VALUES,
  OTHER_ANIMAL_KEYS,
  SWISS_NPA_REGEX,
  SWISS_PHONE_REGEX,
  hasAnyAvailabilitySlot,
} from "./options";

// ---------------------------------------------------------------------------
// Availability grid schema
// ---------------------------------------------------------------------------

const daySlotsSchema = z.object({
  matin: z.boolean(),
  apresMidi: z.boolean(),
  journeeEntiere: z.boolean(),
});

const availabilityStructuredSchema = z
  .object({
    lundi: daySlotsSchema,
    mardi: daySlotsSchema,
    mercredi: daySlotsSchema,
    jeudi: daySlotsSchema,
    vendredi: daySlotsSchema,
    samedi: daySlotsSchema,
    dimanche: daySlotsSchema,
  })
  .refine(hasAnyAvailabilitySlot, {
    message: "Merci de sélectionner au moins un créneau de disponibilité.",
  });

// ---------------------------------------------------------------------------
// Other animals schema (nested)
// ---------------------------------------------------------------------------

const otherAnimalsSchema = z.object({
  none: z.boolean().default(false),
  dogs: z.boolean().default(false),
  cats: z.boolean().default(false),
  others: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Full application schema (client + server)
//
// Notes:
//  - `phone` must already be normalized to `+41XXXXXXXXX` before this schema
//    is run (the client PhoneInput does that; the API route re-normalizes
//    defensively).
//  - All "Other" free-text fields are validated conditionally via `superRefine`.
// ---------------------------------------------------------------------------

const nonEmptyTrim = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .min(min, msg)
    .max(max, `Maximum ${max} caractères.`);

export const sitterApplicationSchemaV2 = z
  .object({
    // ----- Step 1: personal infos -------------------------------------------
    firstName: nonEmptyTrim(2, 50, "Prénom requis (min. 2 caractères)."),
    lastName: nonEmptyTrim(2, 50, "Nom requis (min. 2 caractères)."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Email invalide.")
      .max(200, "Email trop long."),
    phone: z
      .string()
      .trim()
      .regex(
        SWISS_PHONE_REGEX,
        "Numéro suisse requis au format +41 79 123 45 67.",
      ),
    age: z
      .number()
      .int("Âge invalide.")
      .min(16, "Tu dois avoir au moins 16 ans.")
      .max(99, "Âge invalide.")
      .optional()
      .nullable(),

    city: z.enum(CITY_VALUES, {
      message: "Merci de sélectionner une ville.",
    }),
    cityOther: z.string().trim().max(120).optional().nullable(),
    npa: z
      .string()
      .trim()
      .regex(SWISS_NPA_REGEX, "NPA suisse invalide (4 chiffres)."),

    // ----- Step 2: sitter profile -------------------------------------------
    linkAnimalProfession: z.enum(LINK_ANIMAL_PROFESSION_VALUES, {
      message: "Merci de choisir une option.",
    }),
    linkAnimalProfessionOther: z.string().trim().max(200).optional().nullable(),

    gardeExperienceLevel: z.enum(GARDE_EXPERIENCE_LEVEL_VALUES, {
      message: "Merci de choisir une option.",
    }),

    experienceText: nonEmptyTrim(
      30,
      5000,
      "Expérience requise (min. 30 caractères).",
    ),
    motivationText: nonEmptyTrim(
      80,
      5000,
      "Motivation requise (min. 80 caractères).",
    ),
    allergies: z.string().trim().max(500).optional().nullable(),

    // ----- Step 3: modalities -----------------------------------------------
    availabilityStructured: availabilityStructuredSchema,

    gardeTypes: z
      .array(z.enum(GARDE_TYPE_VALUES))
      .min(1, "Sélectionne au moins un type de garde."),

    dogSizes: z
      .array(z.enum(DOG_SIZE_VALUES))
      .min(1, "Sélectionne au moins une taille de chien."),

    housingType: z.enum(HOUSING_TYPE_VALUES, {
      message: "Merci de choisir un type de logement.",
    }),
    housingTypeOther: z.string().trim().max(200).optional().nullable(),

    otherAnimals: otherAnimalsSchema,
    otherAnimalsDogCount: z
      .number()
      .int()
      .min(1, "Indique le nombre de chiens.")
      .max(20, "Nombre de chiens invalide.")
      .optional()
      .nullable(),

    hasCarLicense: z.boolean().default(false),

    consentInterview: z.literal(true, {
      message: "Merci de confirmer que tu acceptes d'être contacté·e.",
    }),
    consentPrivacy: z.literal(true, {
      message: "Merci d'accepter la politique de confidentialité.",
    }),

    // Legacy free-text availability — kept for compatibility with the existing
    // admin UI and legacy rows. Auto-filled on submit from the structured grid.
    availabilityText: z.string().trim().max(3000).optional(),

    // Tracking / honeypot
    utmSource: z.string().max(120).optional().nullable(),
    utmMedium: z.string().max(120).optional().nullable(),
    utmCampaign: z.string().max(120).optional().nullable(),
    utmContent: z.string().max(120).optional().nullable(),
    utmTerm: z.string().max(120).optional().nullable(),
    referrer: z.string().max(500).optional().nullable(),
    company: z.string().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    // If "Other city" is picked, cityOther is mandatory.
    if (data.city === CITY_OTHER_VALUE) {
      if (!data.cityOther || data.cityOther.trim().length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["cityOther"],
          message: "Merci de préciser ta ville (min. 2 caractères).",
        });
      }
    }

    // "Other" profession requires free text.
    if (data.linkAnimalProfession === "other") {
      if (
        !data.linkAnimalProfessionOther ||
        data.linkAnimalProfessionOther.trim().length < 2
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["linkAnimalProfessionOther"],
          message: "Merci de préciser le métier animalier.",
        });
      }
    }

    // "Other" housing requires free text.
    if (data.housingType === "other") {
      if (!data.housingTypeOther || data.housingTypeOther.trim().length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["housingTypeOther"],
          message: "Merci de préciser le type de logement.",
        });
      }
    }

    // If "dogs" is picked, we expect a dog count.
    if (data.otherAnimals.dogs) {
      if (
        data.otherAnimalsDogCount == null ||
        data.otherAnimalsDogCount < 1
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["otherAnimalsDogCount"],
          message: "Indique le nombre de chiens à ton domicile.",
        });
      }
    }

    // `none` cannot coexist with other animals.
    if (data.otherAnimals.none) {
      const conflicting = OTHER_ANIMAL_KEYS.some(
        (k) => k !== "none" && data.otherAnimals[k],
      );
      if (conflicting) {
        ctx.addIssue({
          code: "custom",
          path: ["otherAnimals"],
          message: "« Aucun » ne peut pas être combiné avec d'autres animaux.",
        });
      }
    }

    // At least one option must be picked in otherAnimals.
    const anyAnimal = OTHER_ANIMAL_KEYS.some((k) => data.otherAnimals[k]);
    if (!anyAnimal) {
      ctx.addIssue({
        code: "custom",
        path: ["otherAnimals"],
        message: "Indique la situation des autres animaux à ton domicile.",
      });
    }
  });

export type SitterApplicationV2 = z.infer<typeof sitterApplicationSchemaV2>;

// ---------------------------------------------------------------------------
// Per-step field lists (used by the multi-step form to run partial validation
// with React Hook Form's `trigger(fieldNames)` before moving to the next step).
// ---------------------------------------------------------------------------

export const STEP_1_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "age",
  "city",
  "cityOther",
  "npa",
] as const;

export const STEP_2_FIELDS = [
  "linkAnimalProfession",
  "linkAnimalProfessionOther",
  "gardeExperienceLevel",
  "experienceText",
  "motivationText",
  "allergies",
] as const;

export const STEP_3_FIELDS = [
  "availabilityStructured",
  "gardeTypes",
  "dogSizes",
  "housingType",
  "housingTypeOther",
  "otherAnimals",
  "otherAnimalsDogCount",
  "hasCarLicense",
  "consentInterview",
  "consentPrivacy",
] as const;

export const ALL_STEPS_FIELDS = [
  ...STEP_1_FIELDS,
  ...STEP_2_FIELDS,
  ...STEP_3_FIELDS,
] as const;

// ---------------------------------------------------------------------------
// Legacy schema kept around for downstream compatibility. The API route now
// accepts a loose "structured-or-legacy" shape via `sitterApplicationApiSchema`
// below.
// ---------------------------------------------------------------------------

export const sitterApplicationApiSchema = z.object({
  // Legacy-required
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(7).max(60),
  age: z.number().int().min(16).max(99).optional().nullable(),
  experienceText: z.string().trim().min(1).max(5000),
  hasDogExperience: z.boolean(),
  motivationText: z.string().trim().min(1).max(5000),
  availabilityText: z.string().trim().min(1).max(3000),
  consentInterview: z.literal(true),
  consentPrivacy: z.literal(true),

  // Structured (all optional for backward compat)
  npa: z.string().trim().optional().nullable(),
  cityOther: z.string().trim().max(120).optional().nullable(),
  linkAnimalProfession: z.string().trim().max(60).optional().nullable(),
  linkAnimalProfessionOther: z.string().trim().max(200).optional().nullable(),
  gardeExperienceLevel: z.string().trim().max(60).optional().nullable(),
  availabilityStructured: z
    .record(z.string(), daySlotsSchema)
    .optional()
    .nullable(),
  gardeTypes: z.array(z.string().trim().max(40)).optional().nullable(),
  dogSizes: z.array(z.string().trim().max(20)).optional().nullable(),
  housingType: z.string().trim().max(60).optional().nullable(),
  housingTypeOther: z.string().trim().max(200).optional().nullable(),
  otherAnimals: otherAnimalsSchema.optional().nullable(),
  otherAnimalsDogCount: z.number().int().min(0).max(20).optional().nullable(),
  hasCarLicense: z.boolean().optional().nullable(),
  allergies: z.string().trim().max(500).optional().nullable(),

  // Tracking
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  utmContent: z.string().max(120).optional().nullable(),
  utmTerm: z.string().max(120).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  company: z.string().max(120).optional(),
});

export type SitterApplicationApiBody = z.infer<typeof sitterApplicationApiSchema>;
