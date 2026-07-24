-- CreateEnum
CREATE TYPE "ServiceReportStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateEnum
CREATE TYPE "DogMood" AS ENUM ('HAPPY', 'CALM', 'TIRED', 'PLAYFUL', 'ANXIOUS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'serviceReportSelfie';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'serviceReportReminder';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'serviceReportReceived';

-- CreateTable
CREATE TABLE "ServiceReport" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "ServiceReportStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "peed" BOOLEAN,
    "pooed" BOOLEAN,
    "drankWater" BOOLEAN,
    "ate" BOOLEAN,
    "played" BOOLEAN,
    "mood" "DogMood",
    "energy" INTEGER,
    "incidents" TEXT,
    "routeJson" JSONB,
    "distanceMeters" INTEGER,
    "trackStartedAt" TIMESTAMP(3),
    "trackEndedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReportPhoto" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "caption" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceReportPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceReport_bookingId_key" ON "ServiceReport"("bookingId");

-- CreateIndex
CREATE INDEX "ServiceReport_sitterId_createdAt_idx" ON "ServiceReport"("sitterId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceReport_ownerId_createdAt_idx" ON "ServiceReport"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceReportPhoto_reportId_idx" ON "ServiceReportPhoto"("reportId");

-- AddForeignKey
ALTER TABLE "ServiceReport" ADD CONSTRAINT "ServiceReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReportPhoto" ADD CONSTRAINT "ServiceReportPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ServiceReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

