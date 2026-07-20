import test from "node:test";
import assert from "node:assert/strict";

import { ownerVisibleConversationWhere } from "../../lib/account/conversationVisibility.ts";

test("owner conversation visibility filter is shared by list + unread count", () => {
  const where = ownerVisibleConversationWhere("owner_123");

  // Scoped to the owner and never shows soft-deleted conversations.
  assert.equal(where.ownerId, "owner_123");
  assert.equal(where.deletedAt, null);

  // Direct-contact conversations (no booking) OR a booking past the unpaid stage.
  assert.ok(Array.isArray(where.OR));
  const branches = where.OR as Array<Record<string, unknown>>;
  assert.equal(branches.length, 2);

  const noBooking = branches.find((b) => "bookingId" in b);
  assert.deepEqual(noBooking, { bookingId: null });

  const paidBooking = branches.find((b) => "booking" in b) as
    | { booking: { status: { notIn: string[] } } }
    | undefined;
  assert.ok(paidBooking);
  // Unpaid drafts / abandoned checkouts are hidden — their unread messages must
  // NOT inflate the dashboard "X Messages" badge (phantom "1 Messages" bug).
  assert.deepEqual(paidBooking!.booking.status.notIn, ["DRAFT", "PENDING_PAYMENT"]);
});
