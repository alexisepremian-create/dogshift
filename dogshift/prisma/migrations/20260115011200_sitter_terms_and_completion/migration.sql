-- AlterTable
ALTER TABLE "SitterProfile" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "SitterProfile" ADD COLUMN     "termsVersion" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN     "profileCompletion" INTEGER NOT NULL DEFAULT 0;
