export type DogShiftReview = {
  id: string;
  sitterId: string;
  bookingId: string;
  rating: number;
  comment?: string;
  authorName: string;
  createdAt: string;
};

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function reviewsStorageKey(sitterId: string) {
  return `ds_reviews_${sitterId}`;
}

export function loadReviewsFromStorage(sitterId: string): DogShiftReview[] {
  if (typeof window === "undefined") return [];
  const key = reviewsStorageKey(sitterId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];

  const parsed = safeParseJson(raw);
  if (!Array.isArray(parsed)) return [];

  const cleaned: DogShiftReview[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<DogShiftReview>;
    if (!r.id || typeof r.id !== "string") continue;
    if (!r.sitterId || typeof r.sitterId !== "string") continue;
    if (!r.bookingId || typeof r.bookingId !== "string") continue;
    if (typeof r.rating !== "number") continue;
    if (!r.authorName || typeof r.authorName !== "string") continue;
    if (!r.createdAt || typeof r.createdAt !== "string") continue;

    const rating = Math.max(1, Math.min(5, r.rating));
    cleaned.push({
      id: r.id,
      sitterId: r.sitterId,
      bookingId: r.bookingId,
      rating,
      comment: typeof r.comment === "string" ? r.comment : undefined,
      authorName: r.authorName,
      createdAt: r.createdAt,
    });
  }

  return cleaned;
}

export function saveReviewsToStorage(sitterId: string, reviews: DogShiftReview[]) {
  if (typeof window === "undefined") return;
  const key = reviewsStorageKey(sitterId);
  window.localStorage.setItem(key, JSON.stringify(reviews));
}

export function upsertReviewInStorage(review: DogShiftReview) {
  const existing = loadReviewsFromStorage(review.sitterId);
  const next = [
    review,
    ...existing.filter((r) => r.bookingId !== review.bookingId),
  ];
  saveReviewsToStorage(review.sitterId, next);
  return next;
}

export function hasReviewForBooking(sitterId: string, bookingId: string) {
  const existing = loadReviewsFromStorage(sitterId);
  return existing.some((r) => r.bookingId === bookingId);
}

export function getReviewForBooking(sitterId: string, bookingId: string) {
  const existing = loadReviewsFromStorage(sitterId);
  return existing.find((r) => r.bookingId === bookingId) ?? null;
}

export function stableReviewId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
