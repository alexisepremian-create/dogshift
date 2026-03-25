-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "lastMinuteSmsSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceConfig" ADD COLUMN     "lastMinuteEnabled" BOOLEAN NOT NULL DEFAULT false;
