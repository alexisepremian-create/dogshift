// Pure gating for who can compose/send a service report. `node --test` safe.
import { serviceStart, type ServiceWindowBooking } from "./currentService.ts";

export type ReportEligibility =
  | { ok: true }
  | { ok: false; reason: "FORBIDDEN" | "NOT_CONFIRMED" | "NOT_STARTED" };

/**
 * A sitter can send a report only for their own booking, once it is CONFIRMED
 * and the service has actually started (so a report always reflects a real,
 * in-progress-or-finished service). The owner never composes a report.
 */
export function canSendReport(
  booking: ServiceWindowBooking & { sitterId: string },
  callerSitterId: string | null,
  now: Date = new Date(),
): ReportEligibility {
  if (!callerSitterId || booking.sitterId !== callerSitterId) return { ok: false, reason: "FORBIDDEN" };
  if (booking.status !== "CONFIRMED") return { ok: false, reason: "NOT_CONFIRMED" };
  const s = serviceStart(booking);
  if (!s || now.getTime() < s.getTime()) return { ok: false, reason: "NOT_STARTED" };
  return { ok: true };
}

/** Editing a DRAFT (note/checklist/photos) is allowed as soon as it's CONFIRMED
 *  + owned by the caller — even slightly before start (the sitter may prep). */
export function canEditReport(
  booking: { sitterId: string; status: string },
  callerSitterId: string | null,
): ReportEligibility {
  if (!callerSitterId || booking.sitterId !== callerSitterId) return { ok: false, reason: "FORBIDDEN" };
  if (booking.status !== "CONFIRMED") return { ok: false, reason: "NOT_CONFIRMED" };
  return { ok: true };
}
