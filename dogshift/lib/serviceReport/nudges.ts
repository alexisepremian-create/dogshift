// Pure timing logic for the two service-report nudges (selfie at midpoint,
// "send the report" at the end). `node --test` safe — only relative imports.
import { serviceStart, serviceEnd, serviceMidpoint, type ServiceWindowBooking } from "./currentService.ts";

/** Daily stays (Pension) get their selfie nudge mid-afternoon, Zurich time. */
const SELFIE_HOUR_ZURICH = 14;
/** How long after the service ends we still nudge for the report. */
export const REPORT_GRACE_MS = 6 * 60 * 60 * 1000;

function zurichParts(d: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hour, minute };
}

/** Zurich calendar day key (YYYY-MM-DD) — used to dedup the daily selfie nudge. */
export function zurichDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isHourly(b: ServiceWindowBooking): boolean {
  return Boolean(b.startAt && b.endAt);
}

/**
 * The sitter should get a "selfie" nudge right now.
 *  - hourly (Promenade/Garde): once the service has passed its midpoint (until end).
 *  - daily (Pension): around 14:00 Zurich on each day of the stay.
 * The per-day idempotency key collapses repeated ticks to a single notification.
 */
export function selfieDue(b: ServiceWindowBooking, now: Date, tickMs: number): boolean {
  if (b.status !== "CONFIRMED") return false;
  const s = serviceStart(b);
  const e = serviceEnd(b);
  if (!s || !e) return false;
  const t = now.getTime();
  if (t < s.getTime() || t > e.getTime()) return false; // only while the service is live
  if (isHourly(b)) {
    const mid = serviceMidpoint(b);
    return Boolean(mid && t >= mid.getTime());
  }
  const { hour, minute } = zurichParts(now);
  return hour === SELFIE_HOUR_ZURICH && minute * 60 * 1000 < tickMs;
}

/** The sitter should get an "envoie le rapport" nudge right now (just after the end). */
export function reportDue(b: ServiceWindowBooking, now: Date, graceMs: number = REPORT_GRACE_MS): boolean {
  if (b.status !== "CONFIRMED") return false;
  const e = serviceEnd(b);
  if (!e) return false;
  const t = now.getTime();
  return t >= e.getTime() && t < e.getTime() + graceMs;
}

export function selfieKey(bookingId: string, now: Date): string {
  return `serviceReportSelfie:${bookingId}:${zurichDateKey(now)}`;
}

export function reportKey(bookingId: string): string {
  return `serviceReportReminder:${bookingId}`;
}
