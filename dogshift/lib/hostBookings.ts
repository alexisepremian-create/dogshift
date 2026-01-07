export type HostBookingStatus = "new" | "accepted" | "declined";

export type HostBooking = {
  bookingId: string;
  createdAt: string;
  sitterId: string;
  sitterName: string;
  sitterCity: string;
  service: string;
  start: string;
  end: string;
  message: string;
  totalClient: number;
  payment: { provider: "mock"; status: "paid" };
  clientName: string;
};

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function hostBookingsStorageKey(sitterId: string) {
  return `ds_host_bookings_${sitterId}`;
}

export function hostRequestStatusStorageKey(sitterId: string) {
  return `ds_host_request_status_${sitterId}`;
}

export function loadHostBookings(sitterId: string): HostBooking[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(hostBookingsStorageKey(sitterId));
  if (!raw) return [];
  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];

  const cleaned: HostBooking[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const b = item as Partial<HostBooking>;
    if (!b.bookingId || typeof b.bookingId !== "string") continue;
    if (!b.createdAt || typeof b.createdAt !== "string") continue;
    if (!b.sitterId || typeof b.sitterId !== "string") continue;
    if (!b.sitterName || typeof b.sitterName !== "string") continue;
    if (!b.sitterCity || typeof b.sitterCity !== "string") continue;
    if (!b.service || typeof b.service !== "string") continue;
    if (typeof b.totalClient !== "number") continue;

    cleaned.push({
      bookingId: b.bookingId,
      createdAt: b.createdAt,
      sitterId: b.sitterId,
      sitterName: b.sitterName,
      sitterCity: b.sitterCity,
      service: b.service,
      start: typeof b.start === "string" ? b.start : "",
      end: typeof b.end === "string" ? b.end : "",
      message: typeof b.message === "string" ? b.message : "",
      totalClient: b.totalClient,
      payment: { provider: "mock", status: "paid" },
      clientName: typeof b.clientName === "string" ? b.clientName : "Client (mock)",
    });
  }

  return cleaned;
}

export function saveHostBookings(sitterId: string, bookings: HostBooking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(hostBookingsStorageKey(sitterId), JSON.stringify(bookings));
}

export function appendHostBooking(booking: HostBooking) {
  const existing = loadHostBookings(booking.sitterId);
  const next = [booking, ...existing.filter((b) => b.bookingId !== booking.bookingId)];
  saveHostBookings(booking.sitterId, next);
  return next;
}

export function loadHostRequestStatus(sitterId: string): Record<string, HostBookingStatus> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(hostRequestStatusStorageKey(sitterId));
  if (!raw) return {};
  const parsed = safeParseJson(raw);
  if (!parsed || typeof parsed !== "object") return {};
  const obj = parsed as Record<string, unknown>;

  const next: Record<string, HostBookingStatus> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "new" || v === "accepted" || v === "declined") next[k] = v;
  }
  return next;
}

export function saveHostRequestStatus(sitterId: string, next: Record<string, HostBookingStatus>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(hostRequestStatusStorageKey(sitterId), JSON.stringify(next));
}

export function setHostRequestStatus(sitterId: string, bookingId: string, status: HostBookingStatus) {
  const existing = loadHostRequestStatus(sitterId);
  const next = { ...existing, [bookingId]: status };
  saveHostRequestStatus(sitterId, next);
  return next;
}
