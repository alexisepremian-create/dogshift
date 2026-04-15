import { z } from "zod";

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    passwordConfirm: z.string().min(1, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export type SetPasswordBody = z.infer<typeof setPasswordSchema>;

const notificationsSchema = z
  .object({
    newMessages: z.boolean(),
    messageReceived: z.boolean(),
    newBookingRequest: z.boolean(),
    bookingConfirmed: z.boolean(),
    paymentReceived: z.boolean(),
    bookingReminder: z.boolean(),
  })
  .partial();

const preferencesSchema = z
  .object({
    language: z.enum(["fr", "en", "it"]),
    timeZone: z.string().max(60),
    dateFormat: z.enum(["auto", "dd/mm/yyyy", "mm/dd/yyyy", "yyyy-mm-dd"]),
  })
  .partial();

export const accountSettingsPatchSchema = z
  .object({
    firstName: z.string().max(80).optional(),
    lastName: z.string().max(80).optional(),
    phone: z.string().max(30).optional().nullable(),
    notifications: notificationsSchema.optional(),
    preferences: preferencesSchema.optional(),
  });

export type AccountSettingsPatch = z.infer<typeof accountSettingsPatchSchema>;
