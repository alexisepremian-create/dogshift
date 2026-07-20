// Shared rule for owner archive / soft-delete of a booking.
//
// Founder rule: you can archive (or, once archived, permanently hide) any
// booking EXCEPT one that is CONFIRMED and hasn't happened yet — an active
// upcoming commitment. A CONFIRMED booking whose date has passed CAN be
// archived/deleted, as can every non-confirmed booking (pending, cancelled…).

type BookingDates = {
  status?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

function toTime(v: Date | string | null | undefined): number | null {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/** A booking is "passed" once its latest known end/start moment is in the past. */
export function isBookingPassed(b: BookingDates, now: Date = new Date()): boolean {
  const candidates = [b.endAt, b.endDate, b.startAt, b.startDate].map(toTime).filter((t): t is number => t !== null);
  if (candidates.length === 0) return false;
  return Math.max(...candidates) < now.getTime();
}

/** Whether the owner may archive or soft-delete this booking. */
export function canOwnerArchiveOrDelete(b: BookingDates, now: Date = new Date()): boolean {
  const status = String(b.status ?? "");
  if (status === "CONFIRMED" && !isBookingPassed(b, now)) return false;
  return true;
}
