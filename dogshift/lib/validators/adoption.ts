import { z } from "zod";

/**
 * Zod schemas for the adoption API.
 *
 * Two layers of validation, on purpose:
 *  - here: shape, types, ranges. A DRAFT listing may be incomplete, so almost
 *    everything is optional on create/update.
 *  - `lib/adoption/legal.ts → checkListingLegality()`: the OPAn art. 76d
 *    completeness gate. It runs only at publication and it is the layer that
 *    actually blocks. Never duplicate those rules here — a half-filled draft
 *    must remain saveable.
 */

export const DOG_SEXES = ["MALE", "FEMALE"] as const;
export const DOG_SIZES = ["SMALL", "MEDIUM", "LARGE", "GIANT"] as const;
export const DOG_PROVENANCES = [
  "PRIVATE_OWNER",
  "SWISS_BREEDER",
  "SWISS_SHELTER",
  "FOREIGN_SHELTER",
  "FOREIGN_BREEDER",
  "FOUND_STRAY",
  "OTHER",
] as const;
export const HOUSING_TYPES = ["APARTMENT", "HOUSE", "FARM"] as const;
export const ADOPTION_APPLICATION_DECISIONS = ["SHORTLISTED", "ACCEPTED", "DECLINED"] as const;

const cantonCode = z
  .string()
  .trim()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Code canton attendu (2 lettres majuscules)");

/** ISO-3166-1 alpha-2, e.g. "CH", "RO". */
const countryCode = z
  .string()
  .trim()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Code pays ISO attendu (2 lettres majuscules)");

const postalCode = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "NPA suisse attendu (4 chiffres)");

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD")
  .refine((v) => Number.isFinite(new Date(`${v}T00:00:00.000Z`).getTime()), {
    message: "Date invalide",
  });

/** R2 object keys produced by the photo presign route. */
const photoKeys = z.array(z.string().min(1).max(400)).max(12);

/**
 * Every listing field. `create` accepts a partial of this (drafts) and
 * `publish` re-reads the persisted row through checkListingLegality().
 */
const listingFields = {
  dogName: z.string().trim().min(1).max(60),
  breed: z.string().trim().max(80).optional().nullable(),
  secondaryBreed: z.string().trim().max(80).optional().nullable(),
  isCrossbreed: z.boolean().optional(),
  sex: z.enum(DOG_SEXES),
  birthDate: dateOnly,
  sizeCategory: z.enum(DOG_SIZES),
  weightKg: z.number().min(0.5).max(120).optional().nullable(),
  neutered: z.boolean().optional().nullable(),
  vaccinated: z.boolean().optional().nullable(),
  dewormed: z.boolean().optional().nullable(),

  // Legal disclosure — enforced at publication, not at draft save.
  microchipNumber: z
    .string()
    .trim()
    .regex(/^\d{15}$/, "Le numéro de puce doit comporter 15 chiffres")
    .optional()
    .nullable(),
  provenance: z.enum(DOG_PROVENANCES),
  breedingCountry: countryCode,
  cedantFullName: z.string().trim().min(3).max(120),
  cedantAddress: z.string().trim().min(3).max(160),
  cedantPostalCode: postalCode,
  cedantCity: z.string().trim().min(2).max(80),

  /// Centimes. "Participation aux frais", capped low on purpose: a four-figure
  /// ask is a sale, not a rehoming.
  feeAmount: z.number().int().min(0).max(300000).optional(),
  reason: z.string().trim().max(2000).optional().nullable(),
  description: z.string().trim().max(4000),
  idealHome: z.string().trim().max(2000).optional().nullable(),
  goodWithChildren: z.boolean().optional().nullable(),
  goodWithDogs: z.boolean().optional().nullable(),
  goodWithCats: z.boolean().optional().nullable(),
  houseTrained: z.boolean().optional().nullable(),
  energyLevel: z.number().int().min(1).max(5).optional().nullable(),
  specialNeeds: z.string().trim().max(2000).optional().nullable(),

  canton: cantonCode,
  city: z.string().trim().min(2).max(80),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
} as const;

/**
 * Creating a listing creates a DRAFT. Only the dog's identity is required —
 * the legal disclosure fields (cédant address, provenance country, chip) can be
 * filled later, because `checkListingLegality()` blocks at publication, not at
 * save. We do require birthDate up front: it drives the 56-day rule and there
 * is no honest placeholder for it.
 */
export const listingCreateSchema = z.object(listingFields).partial().extend({
  dogName: listingFields.dogName,
  sex: listingFields.sex,
  birthDate: listingFields.birthDate,
  sizeCategory: listingFields.sizeCategory,
  provenance: listingFields.provenance,
});

export type ListingCreateBody = z.infer<typeof listingCreateSchema>;

/** Patching a draft (or a published listing's editable fields). */
export const listingUpdateSchema = z
  .object(listingFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Aucun champ à mettre à jour" });

export type ListingUpdateBody = z.infer<typeof listingUpdateSchema>;

/**
 * Publication. The legal checkbox is the only body field — the completeness
 * check reads the persisted row so a client cannot smuggle different values
 * past `checkListingLegality()`.
 */
export const listingPublishSchema = z.object({
  acceptTerms: z.literal(true, {
    message: "Tu dois confirmer que les informations légales sont exactes.",
  }),
});

export type ListingPublishBody = z.infer<typeof listingPublishSchema>;

/**
 * Lifecycle transitions the cédant can trigger by hand.
 * `CONFIRM_AVAILABLE` is the freshness ack (bumps `lastConfirmedAt`) that keeps
 * the listing out of the auto-archive sweep.
 */
export const LISTING_ACTIONS = ["CONFIRM_AVAILABLE", "MARK_ADOPTED", "ARCHIVE", "UNARCHIVE"] as const;

export const listingActionSchema = z.object({
  action: z.enum(LISTING_ACTIONS),
  /** For MARK_ADOPTED: which application won, so we can close the others. */
  applicationId: z.string().trim().min(1).max(60).optional().nullable(),
});

export type ListingActionBody = z.infer<typeof listingActionSchema>;

const boolFromQuery = z
  .enum(["1", "0", "true", "false"])
  .transform((v) => v === "1" || v === "true");

/** Public feed filters. Parsed from `URLSearchParams`, so everything is a string. */
export const listingFeedQuerySchema = z.object({
  /** Comma-separated canton codes. */
  cantons: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}(,[A-Z]{2})*$/, "Cantons attendus : VD,GE,…")
    .optional(),
  sizes: z
    .string()
    .trim()
    .regex(/^(SMALL|MEDIUM|LARGE|GIANT)(,(SMALL|MEDIUM|LARGE|GIANT))*$/)
    .optional(),
  sex: z.enum(DOG_SEXES).optional(),
  minAgeMonths: z.coerce.number().int().min(0).max(300).optional(),
  maxAgeMonths: z.coerce.number().int().min(0).max(300).optional(),
  goodWithChildren: boolFromQuery.optional(),
  goodWithDogs: boolFromQuery.optional(),
  goodWithCats: boolFromQuery.optional(),
  /** Only listings from a verified rescue organisation. */
  verifiedOnly: boolFromQuery.optional(),
  freeOnly: boolFromQuery.optional(),
  /** Adopter position, used to sort by distance. */
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().min(1).max(500).optional(),
  sort: z.enum(["RECENT", "DISTANCE", "YOUNGEST"]).optional(),
  /**
   * Offset, not a keyset cursor: distance ranking happens in memory over a
   * bounded candidate pool, so there is no stable SQL key to page on.
   */
  offset: z.coerce.number().int().min(0).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type ListingFeedQuery = z.infer<typeof listingFeedQuerySchema>;

/** The reusable adopter dossier. Complete-or-nothing: it is what cédants read. */
export const adopterProfileSchema = z
  .object({
    housingType: z.enum(HOUSING_TYPES),
    isHomeOwner: z.boolean(),
    landlordApproval: z.boolean().optional().nullable(),
    hasGarden: z.boolean().optional(),
    gardenFenced: z.boolean().optional().nullable(),
    householdAdults: z.number().int().min(1).max(20),
    householdChildren: z.number().int().min(0).max(20),
    youngestChildAge: z.number().int().min(0).max(25).optional().nullable(),
    hasOtherDogs: z.boolean().optional(),
    hasCats: z.boolean().optional(),
    otherPetsNote: z.string().trim().max(1000).optional().nullable(),
    hoursAlonePerDay: z.number().int().min(0).max(24).optional().nullable(),
    experienceLevel: z.number().int().min(1).max(5),
    previousDogsNote: z.string().trim().max(2000).optional().nullable(),
    activityLevel: z.number().int().min(1).max(5).optional().nullable(),
    canton: cantonCode.optional().nullable(),
    city: z.string().trim().max(80).optional().nullable(),
    motivation: z.string().trim().max(2000).optional().nullable(),
    /** nLPD — explicit consent to share the dossier with cédants. */
    consentShared: z.boolean(),
  })
  // A renter who cannot show the landlord allows dogs is the #1 failed
  // adoption in every shelter's data, so we ask up front.
  .refine((v) => v.isHomeOwner || v.landlordApproval !== null, {
    message: "Indique si ton bailleur autorise les chiens.",
    path: ["landlordApproval"],
  })
  .refine((v) => v.householdChildren === 0 || typeof v.youngestChildAge === "number", {
    message: "Indique l'âge du plus jeune enfant.",
    path: ["youngestChildAge"],
  });

export type AdopterProfileBody = z.infer<typeof adopterProfileSchema>;

/** Applying to a listing. The dossier itself is snapshotted server-side. */
export const applicationCreateSchema = z.object({
  message: z.string().trim().max(2000).optional().nullable(),
});

export type ApplicationCreateBody = z.infer<typeof applicationCreateSchema>;

/** Cédant's decision on an application. */
export const applicationDecisionSchema = z
  .object({
    status: z.enum(ADOPTION_APPLICATION_DECISIONS),
    declineReason: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => v.status !== "DECLINED" || Boolean(v.declineReason), {
    message: "Explique brièvement ton refus — c'est ce qui rend un refus acceptable.",
    path: ["declineReason"],
  });

export type ApplicationDecisionBody = z.infer<typeof applicationDecisionSchema>;

export const adoptionMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export type AdoptionMessageBody = z.infer<typeof adoptionMessageSchema>;

/** Saved search + alert opt-in. `filters` reuses the feed query shape. */
export const savedSearchSchema = z.object({
  label: z.string().trim().max(60).optional().nullable(),
  filters: listingFeedQuerySchema,
  alertsOn: z.boolean().optional(),
});

export type SavedSearchBody = z.infer<typeof savedSearchSchema>;

/**
 * Photos go through their own routes, never through the listing PATCH: the
 * two-phase presign → commit pattern needs a server-side `headObject()` check
 * that the object actually landed in R2 (see CLAUDE.md "File uploads").
 * Upload uses the shared `/api/account/dogs/photo/presign` endpoint.
 */
export const listingPhotoCommitSchema = z.object({
  key: z.string().min(1).max(400),
});

export type ListingPhotoCommitBody = z.infer<typeof listingPhotoCommitSchema>;

/** Reorder — must be a permutation of the keys already on the listing. */
export const listingPhotoOrderSchema = z.object({
  photos: photoKeys,
});

export type ListingPhotoOrderBody = z.infer<typeof listingPhotoOrderSchema>;
