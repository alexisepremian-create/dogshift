-- Booking internal checkout migration
-- Goals:
-- 1) map old Booking.status values to new lifecycle
--    PENDING   -> PENDING_PAYMENT
--    CANCELED  -> CANCELLED
--    PAID      -> PAID
-- 2) add new booking fields used by internal checkout
-- 3) keep existing rows

PRAGMA foreign_keys=OFF;

-- Create new table with the new shape
CREATE TABLE "new_Booking" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sitterId" TEXT NOT NULL,
  "service" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'chf',
  "platformFeeAmount" INTEGER NOT NULL,
  "stripeSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Booking_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User" ("sitterId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Copy data with status mapping
INSERT INTO "new_Booking" (
  "id",
  "userId",
  "sitterId",
  "service",
  "startDate",
  "endDate",
  "message",
  "status",
  "amount",
  "currency",
  "platformFeeAmount",
  "stripeSessionId",
  "stripePaymentIntentId",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "userId",
  "sitterId",
  NULL AS "service",
  NULL AS "startDate",
  NULL AS "endDate",
  NULL AS "message",
  CASE "status"
    WHEN 'PENDING' THEN 'PENDING_PAYMENT'
    WHEN 'CANCELED' THEN 'CANCELLED'
    WHEN 'PAID' THEN 'PAID'
    ELSE 'PENDING_PAYMENT'
  END AS "status",
  "amount",
  "currency",
  "platformFeeAmount",
  "stripeSessionId",
  "stripePaymentIntentId",
  "createdAt",
  "updatedAt"
FROM "Booking";

DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";

-- Recreate indexes
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX "Booking_sitterId_idx" ON "Booking"("sitterId");
CREATE INDEX "Booking_stripeSessionId_idx" ON "Booking"("stripeSessionId");
CREATE INDEX "Booking_stripePaymentIntentId_idx" ON "Booking"("stripePaymentIntentId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
