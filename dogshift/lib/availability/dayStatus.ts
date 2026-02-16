export type DayStatus = "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";

export type SlotLike = {
  status: "AVAILABLE" | "ON_REQUEST" | "UNAVAILABLE";
};

export function summarizeDayStatusFromSlots(slots: SlotLike[]): DayStatus {
  const rows = Array.isArray(slots) ? slots : [];
  let hasOnRequest = false;
  let hasAny = false;

  for (const s of rows) {
    if (!s || typeof s.status !== "string") continue;
    hasAny = true;
    if (s.status === "AVAILABLE") return "AVAILABLE";
    if (s.status === "ON_REQUEST") hasOnRequest = true;
  }

  if (!hasAny) return "UNAVAILABLE";
  if (hasOnRequest) return "ON_REQUEST";
  return "UNAVAILABLE";
}
