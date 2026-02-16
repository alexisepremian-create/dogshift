/*
  Warnings:

  - Added the required column `serviceType` to the `AvailabilityException` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceType` to the `AvailabilityRule` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AvailabilityException_sitterId_date_idx";

-- DropIndex
DROP INDEX "AvailabilityException_sitterId_idx";

-- DropIndex
DROP INDEX "AvailabilityRule_sitterId_dayOfWeek_idx";

-- DropIndex
DROP INDEX "AvailabilityRule_sitterId_idx";

-- AlterTable
ALTER TABLE "AvailabilityException" ADD COLUMN     "serviceType" "ServiceType" NOT NULL;

-- AlterTable
ALTER TABLE "AvailabilityRule" ADD COLUMN     "serviceType" "ServiceType" NOT NULL;

-- CreateTable
CREATE TABLE "AvailabilityAuditLog" (
    "id" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "serviceType" "ServiceType",
    "dateKey" TEXT,
    "payloadSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityAuditLog_sitterId_createdAt_idx" ON "AvailabilityAuditLog"("sitterId", "createdAt");

-- CreateIndex
CREATE INDEX "AvailabilityAuditLog_sitterId_serviceType_createdAt_idx" ON "AvailabilityAuditLog"("sitterId", "serviceType", "createdAt");

-- CreateIndex
CREATE INDEX "AvailabilityException_sitterId_serviceType_date_idx" ON "AvailabilityException"("sitterId", "serviceType", "date");

-- CreateIndex
CREATE INDEX "AvailabilityException_sitterId_serviceType_idx" ON "AvailabilityException"("sitterId", "serviceType");

-- CreateIndex
CREATE INDEX "AvailabilityRule_sitterId_serviceType_dayOfWeek_idx" ON "AvailabilityRule"("sitterId", "serviceType", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityRule_sitterId_serviceType_idx" ON "AvailabilityRule"("sitterId", "serviceType");
