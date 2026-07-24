import { z } from "zod";

/** Zod schemas for the breeding-match ("Tinder pour chiens") API. */

export const MATING_GOALS = ["LITTER", "STUD", "EXPLORING"] as const;
export const SWIPE_DIRECTIONS = ["LIKE", "PASS"] as const;

/**
 * Enable / update a dog's mating profile. `acceptTerms` is the single légal
 * checkbox (founder chose light gating) — it must be true whenever the profile
 * is being made discoverable (`enabled`).
 */
export const matingEnableSchema = z
  .object({
    dogProfileId: z.string().min(1),
    enabled: z.boolean().optional().default(true),
    goal: z.enum(MATING_GOALS).optional().default("EXPLORING"),
    bio: z.string().max(500).optional().nullable(),
    region: z.string().max(80).optional().nullable(),
    acceptTerms: z.boolean(),
  })
  .refine((d) => !d.enabled || d.acceptTerms === true, {
    message: "Tu dois accepter les conditions pour activer le profil d'accouplement.",
    path: ["acceptTerms"],
  });

export type MatingEnableBody = z.infer<typeof matingEnableSchema>;

/** One swipe of the active dog onto a candidate. */
export const swipeSchema = z.object({
  swiperDogId: z.string().min(1),
  targetDogId: z.string().min(1),
  direction: z.enum(SWIPE_DIRECTIONS),
});

export type SwipeBody = z.infer<typeof swipeSchema>;

/** Deck query filters (all optional). */
export const deckQuerySchema = z.object({
  swiperDogId: z.string().min(1),
  breedMode: z.enum(["same", "any"]).optional().default("any"),
  size: z.enum(["small", "medium", "large"]).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  limit: z.coerce.number().int().min(1).max(30).optional().default(10),
});

export type DeckQuery = z.infer<typeof deckQuerySchema>;

/** A message inside a match thread. */
export const matchMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export type MatchMessageBody = z.infer<typeof matchMessageSchema>;
