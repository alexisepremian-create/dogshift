-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('not_verified', 'pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "SitterProfile" ADD COLUMN     "idDocumentUrl" TEXT,
ADD COLUMN     "selfieUrl" TEXT,
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationReviewedAt" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'not_verified',
ADD COLUMN     "verificationSubmittedAt" TIMESTAMP(3),
ALTER COLUMN "lat" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "lng" SET DATA TYPE DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "VerificationAccessLog" (
    "id" TEXT NOT NULL,
    "sitterProfileId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fileKey" TEXT,
    "adminClerkUserId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationAccessLog_sitterProfileId_createdAt_idx" ON "VerificationAccessLog"("sitterProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAccessLog_sitterId_createdAt_idx" ON "VerificationAccessLog"("sitterId", "createdAt");

-- CreateIndex
CREATE INDEX "SitterProfile_verificationStatus_idx" ON "SitterProfile"("verificationStatus");

-- AddForeignKey
ALTER TABLE "VerificationAccessLog" ADD CONSTRAINT "VerificationAccessLog_sitterProfileId_fkey" FOREIGN KEY ("sitterProfileId") REFERENCES "SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
