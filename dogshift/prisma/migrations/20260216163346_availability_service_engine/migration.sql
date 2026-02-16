-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('PROMENADE', 'DOGSITTING', 'PENSION');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'ON_REQUEST', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "serviceType" "ServiceType",
ADD COLUMN     "startAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceConfig" (
    "id" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "slotStepMin" INTEGER NOT NULL,
    "minDurationMin" INTEGER NOT NULL,
    "maxDurationMin" INTEGER NOT NULL,
    "leadTimeMin" INTEGER NOT NULL,
    "bufferBeforeMin" INTEGER NOT NULL,
    "bufferAfterMin" INTEGER NOT NULL,
    "overnightRequired" BOOLEAN NOT NULL DEFAULT false,
    "checkInStartMin" INTEGER,
    "checkInEndMin" INTEGER,
    "checkOutStartMin" INTEGER,
    "checkOutEndMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityRule_sitterId_dayOfWeek_idx" ON "AvailabilityRule"("sitterId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityRule_sitterId_idx" ON "AvailabilityRule"("sitterId");

-- CreateIndex
CREATE INDEX "AvailabilityException_sitterId_date_idx" ON "AvailabilityException"("sitterId", "date");

-- CreateIndex
CREATE INDEX "AvailabilityException_sitterId_idx" ON "AvailabilityException"("sitterId");

-- CreateIndex
CREATE INDEX "ServiceConfig_sitterId_idx" ON "ServiceConfig"("sitterId");

-- CreateIndex
CREATE INDEX "ServiceConfig_serviceType_idx" ON "ServiceConfig"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConfig_sitterId_serviceType_key" ON "ServiceConfig"("sitterId", "serviceType");

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User"("sitterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User"("sitterId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceConfig" ADD CONSTRAINT "ServiceConfig_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User"("sitterId") ON DELETE CASCADE ON UPDATE CASCADE;
