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
