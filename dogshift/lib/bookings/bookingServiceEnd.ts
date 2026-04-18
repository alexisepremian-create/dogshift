/**
 * When an owner may delete their account we only block on bookings that are
 * still "live": payment / acceptance in flight, or paid/confirmed service whose
 * end time (in Europe/Zurich for multi-day stays) is still in the future.
 */

const TIMEZONE_ZURICH = "Europe/Zurich";

const zurichYmdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE_ZURICH,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function zurichYmdFromMs(ms: number): string {
  return zurichYmdFormatter.format(new Date(ms));
}

/** First UTC instant whose Zurich civil calendar is strictly after `ymd` (YYYY-MM-DD). */
function firstInstantAfterZurichCivilDay(ymd: string): Date | null {
  let lo = Date.parse(`${ymd}T12:00:00Z`);
  if (!Number.isFinite(lo)) return null;
  for (let i = 0; i < 96 && zurichYmdFromMs(lo) !== ymd; i++) lo -= 3600 * 1000;
  for (let i = 0; i < 96 && zurichYmdFromMs(lo) !== ymd; i++) lo += 3600 * 1000;
  if (zurichYmdFromMs(lo) !== ymd) return null;

  let hi = lo + 26 * 3600 * 1000;
  for (let i = 0; i < 96 && zurichYmdFromMs(hi) === ymd; i++) hi += 3600 * 1000;

  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (zurichYmdFromMs(mid) === ymd) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

function endOfZurichCivilDayInclusive(ymd: string): Date | null {
  const next = firstInstantAfterZurichCivilDay(ymd);
  if (!next || !Number.isFinite(next.getTime())) return null;
  return new Date(next.getTime() - 1);
}

/** Multi-day owner services: DB `endDate` is stored at UTC midnight of the checkout calendar day. */
const DAILY_OWNER_SERVICES = new Set(["Pension", "Garde"]);

export function bookingServiceEndUtc(booking: {
  service?: string | null;
  endDate?: Date | null;
  endAt?: Date | null;
}): Date | null {
  const end = booking.endAt ?? booking.endDate;
  if (!end) return null;
  const endDate = end instanceof Date ? end : new Date(end);
  const t = endDate.getTime();
  if (!Number.isFinite(t)) return null;

  const svc = typeof booking.service === "string" ? booking.service.trim() : "";
  if (DAILY_OWNER_SERVICES.has(svc)) {
    const ymd = zurichYmdFromMs(t);
    return endOfZurichCivilDayInclusive(ymd);
  }
  return endDate;
}

export function ownerBookingBlocksAccountDeletion(
  booking: {
    status: string;
    archivedAt?: Date | null;
    service?: string | null;
    endDate?: Date | null;
    endAt?: Date | null;
  },
  now: Date
): boolean {
  if (booking.archivedAt) return false;
  const st = String(booking.status ?? "");
  if (st === "PENDING_PAYMENT" || st === "PENDING_ACCEPTANCE") return true;
  if (st !== "PAID" && st !== "CONFIRMED") return false;
  const end = bookingServiceEndUtc(booking);
  if (!end) return true;
  return end.getTime() > now.getTime();
}
