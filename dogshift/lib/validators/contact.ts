import { z } from "zod";

export const contactSchema = z.object({
  message: z
    .string()
    .min(1, "Message is required")
    .max(5000, "Message must be under 5000 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export type ContactBody = z.infer<typeof contactSchema>;

export const inviteVerifySchema = z.object({
  code: z.string().min(1, "Code is required").max(64, "Code is too long"),
});

export type InviteVerifyBody = z.infer<typeof inviteVerifySchema>;

export const sitterApplicationSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  city: z.string().min(1).max(120),
  email: z.string().email("Invalid email"),
  phone: z
    .string()
    .min(7)
    .max(60)
    .regex(/^[+()\d][\d()\s-]{6,}$/, "Invalid phone number"),
  age: z.number().int().min(16).max(99).optional().nullable(),
  experienceText: z.string().min(1).max(5000),
  hasDogExperience: z.boolean(),
  motivationText: z.string().min(1).max(5000),
  availabilityText: z.string().min(1).max(3000),
  consentInterview: z.literal(true, "You must consent to the interview"),
  consentPrivacy: z.literal(true, "You must accept the privacy policy"),
  // Optional UTM / tracking fields
  utmSource: z.string().max(120).optional().nullable(),
  utmMedium: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  utmContent: z.string().max(120).optional().nullable(),
  utmTerm: z.string().max(120).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  // Honeypot — validated server-side as empty
  company: z.string().max(120).optional(),
});

export type SitterApplicationBody = z.infer<typeof sitterApplicationSchema>;
