import { z } from "zod";
import { isoDateString, isoDatetimeString } from "./common";

const ALLOWED_SERVICES = ["Pension", "Garde", "Promenade"] as const;

const dailyBookingBody = z.object({
  sitterId: z.string().min(1, "sitterId is required"),
  service: z.enum(["Pension", "Garde"]),
  startDate: isoDateString,
  endDate: isoDateString,
  message: z.string().max(2000).optional().nullable(),
});

const hourlyBookingBody = z.object({
  sitterId: z.string().min(1, "sitterId is required"),
  service: z.literal("Promenade"),
  startAt: isoDatetimeString,
  endAt: isoDatetimeString,
  message: z.string().max(2000).optional().nullable(),
});

/**
 * Union schema: validates a booking creation body.
 * - Daily services (Pension, Garde) require startDate + endDate.
 * - Hourly services (Promenade) require startAt + endAt.
 */
export const createBookingSchema = z
  .union([dailyBookingBody, hourlyBookingBody])
  .superRefine((val, ctx) => {
    if (val.service === "Pension" || val.service === "Garde") {
      const v = val as z.infer<typeof dailyBookingBody>;
      if (v.startDate >= v.endDate && val.service === "Pension") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "endDate must be after startDate for Pension",
          path: ["endDate"],
        });
      }
    }
  });

export type CreateBookingBody = z.infer<typeof createBookingSchema>;
