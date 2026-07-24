// Pure service-window helpers for the report feature. Imports only the (@/-free)
// bookingServiceEndUtc via a relative path so it runs under `node --test`.
import { bookingServiceEndUtc } from "../bookings/bookingServiceEnd.ts";

export type ServiceWindowBooking = {
  status: string;
  service?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
};

/** Actual service start: precise `startAt` (hourly) or `startDate` (daily). */
export function serviceStart(b: ServiceWindowBooking): Date | null {
  return b.startAt ?? b.startDate ?? null;
}

/** Actual service end (Zurich end-of-day for multi-day stays). */
export function serviceEnd(b: ServiceWindowBooking): Date | null {
  return bookingServiceEndUtc(b);
}

/** The service is happening right now (CONFIRMED and within [start, end]). */
export function isLive(b: ServiceWindowBooking, now: Date = new Date()): boolean {
  if (b.status !== "CONFIRMED") return false;
  const s = serviceStart(b);
  const e = serviceEnd(b);
  if (!s || !e) return false;
  const t = now.getTime();
  return t >= s.getTime() && t <= e.getTime();
}

/** Midpoint of the service (for the "selfie" nudge). */
export function serviceMidpoint(b: ServiceWindowBooking): Date | null {
  const s = serviceStart(b);
  const e = serviceEnd(b);
  if (!s || !e) return null;
  return new Date(Math.floor((s.getTime() + e.getTime()) / 2));
}
