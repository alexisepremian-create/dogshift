-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "stripeApplicationFeeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stripeTransferId" TEXT;

-- AlterTable
ALTER TABLE "SitterProfile" ADD COLUMN     "stripeAccountId" TEXT,
ADD COLUMN     "stripeAccountStatus" TEXT,
ADD COLUMN     "stripeOnboardingCompletedAt" TIMESTAMP(3);
