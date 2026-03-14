ALTER TABLE "Booking"
ADD COLUMN "stripeChargeId" TEXT,
ADD COLUMN "stripeProcessingFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "sitterPayoutAmount" INTEGER,
ADD COLUMN "payoutReleasedAt" TIMESTAMP(3);
