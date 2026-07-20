import type { Prisma } from "@prisma/client";

/**
 * SINGLE source of truth for "which conversations can an owner actually see".
 *
 * A conversation is visible to its owner when it is NOT soft-deleted AND it is
 * either a direct contact (no booking) OR its booking has moved past the unpaid
 * stage (DRAFT / PENDING_PAYMENT). A conversation attached to an unpaid/abandoned
 * checkout is intentionally hidden from the owner's Messages list.
 *
 * The conversation LIST endpoint and the dashboard unread-message COUNT MUST use
 * this same filter — otherwise the "X Messages" badge counts messages in
 * conversations the owner can't open, producing a phantom unread (founder saw
 * "1 Messages" while the list showed "Aucune conversation").
 */
export function ownerVisibleConversationWhere(ownerId: string): Prisma.ConversationWhereInput {
  return {
    ownerId,
    deletedAt: null,
    OR: [
      { bookingId: null },
      { booking: { status: { notIn: ["DRAFT", "PENDING_PAYMENT"] } } },
    ],
  };
}
