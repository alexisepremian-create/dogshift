import { z } from "zod";

/** Zod schemas for the service-report API. */

export const DOG_MOODS = ["HAPPY", "CALM", "TIRED", "PLAYFUL", "ANXIOUS"] as const;

/** Upsert the report draft (checklist + note). Photos + GPS have their own routes. */
export const reportUpsertSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
  peed: z.boolean().optional().nullable(),
  pooed: z.boolean().optional().nullable(),
  drankWater: z.boolean().optional().nullable(),
  ate: z.boolean().optional().nullable(),
  played: z.boolean().optional().nullable(),
  mood: z.enum(DOG_MOODS).optional().nullable(),
  energy: z.number().int().min(1).max(5).optional().nullable(),
  incidents: z.string().max(2000).optional().nullable(),
});

export type ReportUpsertBody = z.infer<typeof reportUpsertSchema>;

/** Commit an uploaded report photo. */
export const reportPhotoCommitSchema = z.object({
  key: z.string().min(1).max(400),
  caption: z.string().max(200).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  takenAt: z.string().datetime().optional().nullable(),
});

export type ReportPhotoCommitBody = z.infer<typeof reportPhotoCommitSchema>;

/** Save the GPS walk track (PR6). Polyline [[lat,lng], …]. */
export const reportTrackSchema = z.object({
  route: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).max(5000),
  distanceMeters: z.number().int().min(0).max(500000).optional().nullable(),
  trackStartedAt: z.string().datetime().optional().nullable(),
  trackEndedAt: z.string().datetime().optional().nullable(),
});

export type ReportTrackBody = z.infer<typeof reportTrackSchema>;
