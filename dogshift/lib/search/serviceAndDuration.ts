/**
 * Small shared helpers for the search → availability bridge.
 *  - FR service label ("Promenade"/"Garde"/"Pension") ↔ Prisma enum
 *    ("PROMENADE"/"DOGSITTING"/"PENSION").
 *  - Parse the homepage duration string ("2h", "2h30") into minutes.
 */
export type ServiceLabel = "Promenade" | "Garde" | "Pension";
export type ServiceEnum = "PROMENADE" | "DOGSITTING" | "PENSION";

const LABEL_TO_ENUM: Record<string, ServiceEnum> = {
  Promenade: "PROMENADE",
  Garde: "DOGSITTING",
  Pension: "PENSION",
};

/** Map a FR service label (or already-enum value) to the Prisma enum. */
export function serviceLabelToEnum(label: string | null | undefined): ServiceEnum | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (trimmed === "PROMENADE" || trimmed === "DOGSITTING" || trimmed === "PENSION") {
    return trimmed;
  }
  return LABEL_TO_ENUM[trimmed] ?? null;
}

/** Parse "2h" → 120, "2h30" → 150, "1h" → 60. Returns null if unparseable. */
export function parseDurationToMin(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const m = /^(\d{1,2})h(\d{2})?$/.exec(duration.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const mins = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  const total = hours * 60 + mins;
  return total > 0 ? total : null;
}
