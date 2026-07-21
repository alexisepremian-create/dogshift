export type OwnerBookingListItem = {
  id: string;
  createdAt: string;
  archivedAt?: string | null;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  startAt?: string | null;
  endAt?: string | null;
  status: string;
  hasReview: boolean;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  sitter: { sitterId: string; name: string; avatarUrl: string | null; city?: string | null; postalCode?: string | null };
};

// In-session cache of the owner's bookings list, SHARED between the Réservations
// page and the dashboard. The bottom-nav "Réservations" tab is a full route (a
// server round-trip for the force-dynamic account layout) THEN a client data
// fetch — so it feels slow on first tap. The native dashboard warms this cache in
// the background, so by the time the owner taps Réservations the list is already
// here and paints instantly. Cleared on a full page reload.
let cache: OwnerBookingListItem[] | null = null;
let inflight: Promise<void> | null = null;

export function getCachedOwnerBookings(): OwnerBookingListItem[] | null {
  return cache;
}

export function setCachedOwnerBookings(list: OwnerBookingListItem[]): void {
  cache = list;
}

/**
 * Fetch the bookings list into the cache if it isn't there yet. Deduped and never
 * throws — safe to fire-and-forget from the dashboard to warm the cache.
 */
export function prefetchOwnerBookings(): Promise<void> {
  if (cache !== null) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/account/bookings", { method: "GET" });
      const payload = (await res.json()) as { ok?: boolean; bookings?: OwnerBookingListItem[] };
      if (res.ok && payload?.ok && Array.isArray(payload.bookings)) {
        cache = payload.bookings;
      }
    } catch {
      /* ignore — the page will fetch normally on mount */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
