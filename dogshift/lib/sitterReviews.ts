import { prisma } from "@/lib/prisma";

export type SitterReviewItem = {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  authorName: string;
  anonymous: boolean;
  createdAt: string;
};

export type SitterReviewSnapshot = {
  averageRating: number | null;
  countReviews: number;
  reviews: SitterReviewItem[];
};

export async function getSitterReviewSnapshot(sitterId: string): Promise<SitterReviewSnapshot> {
  const normalizedSitterId = typeof sitterId === "string" ? sitterId.trim() : "";
  if (!normalizedSitterId) {
    return { averageRating: null, countReviews: 0, reviews: [] };
  }

  const [aggregate, reviewsRaw] = await Promise.all([
    (prisma as any).review.aggregate({
      where: { sitterId: normalizedSitterId },
      _count: { id: true },
      _avg: { rating: true },
    }),
    (prisma as any).review.findMany({
      where: { sitterId: normalizedSitterId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        bookingId: true,
        rating: true,
        comment: true,
        anonymous: true,
        createdAt: true,
        owner: { select: { name: true } },
      },
      take: 20,
    }),
  ]);

  const countReviews = typeof aggregate?._count?.id === "number" ? aggregate._count.id : 0;
  const averageRating = typeof aggregate?._avg?.rating === "number" && Number.isFinite(aggregate._avg.rating) ? aggregate._avg.rating : null;

  const reviews: SitterReviewItem[] = Array.isArray(reviewsRaw)
    ? reviewsRaw.map((review: any) => ({
        id: String(review.id),
        bookingId: String(review.bookingId),
        rating: typeof review.rating === "number" && Number.isFinite(review.rating) ? review.rating : 0,
        comment: typeof review.comment === "string" ? review.comment : null,
        authorName:
          review.anonymous === true
            ? "Utilisateur anonyme"
            : typeof review.owner?.name === "string" && review.owner.name.trim()
              ? review.owner.name.trim()
              : "Client DogShift",
        anonymous: Boolean(review.anonymous),
        createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : new Date(review.createdAt).toISOString(),
      }))
    : [];

  return {
    averageRating,
    countReviews,
    reviews,
  };
}
