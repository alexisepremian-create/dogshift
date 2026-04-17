CREATE TYPE "FinanceActorType" AS ENUM ('SYSTEM', 'ADMIN', 'STRIPE');

CREATE TABLE "BookingFinanceEvent" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "payoutMethod" "BookingPayoutMethod",
  "payoutStatus" "BookingPayoutStatus",
  "amount" INTEGER,
  "currency" TEXT,
  "stripeChargeId" TEXT,
  "stripeTransferId" TEXT,
  "stripePaymentIntentId" TEXT,
  "metadata" JSONB,
  "actorType" "FinanceActorType",
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingFinanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingFinanceEvent_bookingId_createdAt_idx" ON "BookingFinanceEvent"("bookingId", "createdAt");
CREATE INDEX "BookingFinanceEvent_eventType_createdAt_idx" ON "BookingFinanceEvent"("eventType", "createdAt");
CREATE INDEX "BookingFinanceEvent_actorType_createdAt_idx" ON "BookingFinanceEvent"("actorType", "createdAt");

ALTER TABLE "BookingFinanceEvent"
ADD CONSTRAINT "BookingFinanceEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
