export type ReasonBucketKey =
  | "booking_existing"
  | "booking_pending"
  | "exception"
  | "rules"
  | "lead_time"
  | "outside_hours"
  | "other";

export const BUCKET_LABELS_FR: Record<ReasonBucketKey, string> = {
  booking_existing: "Réservation existante",
  booking_pending: "Réservation en attente",
  exception: "Exception",
  rules: "Règles du sitter",
  lead_time: "Délai minimum",
  outside_hours: "Hors horaires définis",
  other: "Indisponible",
};

export function mapReasonToBucket(reason?: string | null): ReasonBucketKey {
  const r = typeof reason === "string" ? reason : "";
  if (!r) return "other";

  if (r.startsWith("booking_") && (r.includes("confirmed") || r.includes("paid"))) return "booking_existing";
  if (r.startsWith("booking_pending")) return "booking_pending";
  if (r.startsWith("exception_")) return "exception";
  if (r.startsWith("rule_")) return "rules";
  if (r === "lead_time") return "lead_time";
  if (r === "outside_rule") return "outside_hours";

  return "other";
}

export function bucketDetailFr(key: ReasonBucketKey): string {
  switch (key) {
    case "booking_existing":
      return "Ce créneau chevauche une réservation.";
    case "booking_pending":
      return "Une réservation est en cours sur ce créneau.";
    case "exception":
      return "Une exception modifie les disponibilités ce jour.";
    case "rules":
      return "Ce créneau dépend des horaires définis par le sitter.";
    case "lead_time":
      return "Le délai minimum avant réservation n’est pas respecté.";
    case "outside_hours":
      return "Ce créneau dépasse les horaires disponibles.";
    case "other":
    default:
      return "Ce créneau n’est pas réservable.";
  }
}
