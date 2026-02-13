-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_sitterId_date_idx" ON "Availability"("sitterId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_sitterId_date_key" ON "Availability"("sitterId", "date");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User"("sitterId") ON DELETE CASCADE ON UPDATE CASCADE;
