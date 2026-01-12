-- Add NotificationType enum
DO $$
BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'newMessages',
    'newBookingRequest',
    'paymentReceived',
    'bookingConfirmed',
    'bookingReminder'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create Notification table
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "entityId" TEXT,
  "url" TEXT,
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE UNIQUE INDEX "Notification_userId_idempotencyKey_key" ON "Notification"("userId", "idempotencyKey");
