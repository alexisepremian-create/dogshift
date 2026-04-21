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
    /**
     * Legacy base64 data URL for avatar. New avatars use R2 upload + `avatarUrl` path,
     * but existing profiles may still roundtrip a large data URL here. The server
     * strips oversized values (>120k) at write time, so we only apply a generous cap
     * to avoid huge payloads — never reject a save over a legacy avatar.
     */
    avatarDataUrl: z.string().max(5_000_000).optional().nullable(),
    /**
     * First-party R2 avatar path (`/api/media/sitter-avatar/...`). Legacy profiles may
     * still have other strings here (cloud URLs, etc.). We accept any string up to 480
     * chars; the server only writes it to the `avatarUrl` DB column when it actually
     * matches the persisted media format, so legacy values are ignored safely rather
     * than blocking the entire profile save.
     */
    avatarUrl: z.string().max(480).optional().nullable(),
    published: z.boolean().optional(),
  })
  .passthrough();

export type HostProfileUpdateBody = z.infer<typeof hostProfileUpdateSchema>;
