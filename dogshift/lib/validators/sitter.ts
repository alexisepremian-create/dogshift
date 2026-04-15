import { z } from "zod";

const PRICING_SERVICES = ["Promenade", "Garde", "Pension"] as const;

/**
 * Pricing update: an object with optional service keys, each a positive number.
 * Unknown keys are stripped; empty values are allowed (they disable the service).
 */
export const pricingUpdateSchema = z.object({
  pricing: z
    .record(z.string(), z.union([z.number().positive().finite(), z.literal(""), z.null()]))
    .refine(
      (obj) =>
        Object.keys(obj).every((k) => PRICING_SERVICES.includes(k as (typeof PRICING_SERVICES)[number])),
      { message: "pricing keys must be one of: Promenade, Garde, Pension" }
    ),
});

export type PricingUpdateBody = z.infer<typeof pricingUpdateSchema>;

/**
 * Host profile update: partial object for profile fields editable by sitters.
 */
export const hostProfileUpdateSchema = z
  .object({
    firstName: z.string().max(80).optional(),
    lastName: z.string().max(80).optional(),
    bio: z.string().max(2000).optional().nullable(),
    city: z.string().max(120).optional().nullable(),
    postalCode: z.string().max(10).optional().nullable(),
    lat: z.number().finite().optional().nullable(),
    lng: z.number().finite().optional().nullable(),
    services: z.record(z.string(), z.boolean()).optional(),
    pricing: z.record(z.string(), z.union([z.number().positive(), z.null()])).optional(),
    dogSizes: z.record(z.string(), z.boolean()).optional(),
    avatarDataUrl: z.string().max(2_000_000).optional().nullable(),
    published: z.boolean().optional(),
  })
  .passthrough();

export type HostProfileUpdateBody = z.infer<typeof hostProfileUpdateSchema>;
