import { z } from "zod";

/**
 * Body schema for POST /api/emails/send-application-email.
 *
 * Triggered by the external n8n scoring workflow after it classifies a sitter
 * application into one of three buckets:
 *
 *   - HIGH   → candidate accepted for interview (requires a Calendly link).
 *   - REVIEW → candidate needs manual review; acknowledgment email only.
 *   - LOW    → candidate rejected; polite, non-disclosive email.
 *
 * The `score` field is optional and never rendered in the email — it's only
 * kept on the server side for logs / Sentry breadcrumbs (debug only).
 */
export const sendApplicationEmailSchema = z
  .object({
    firstName: z.string().trim().min(1, "firstName requis").max(100),
    lastName: z.string().trim().min(1, "lastName requis").max(100),
    email: z.string().trim().toLowerCase().email("email invalide"),
    status: z.enum(["HIGH", "REVIEW", "LOW"]),
    score: z.number().int().min(0).max(100).optional(),
    calendlyLink: z.string().url("calendlyLink doit être une URL valide").optional(),
    // Optional so legacy n8n workflow configs (that don't pass it) keep
    // working. When present, the backend tracks the HIGH email emission on
    // the matching PilotSitterApplication (acceptedEmailSentAt + Source).
    applicationId: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === "HIGH" && !val.calendlyLink) {
      ctx.addIssue({
        code: "custom",
        path: ["calendlyLink"],
        message: "calendlyLink est requis quand status=HIGH",
      });
    }
  });

export type SendApplicationEmailBody = z.infer<typeof sendApplicationEmailSchema>;
