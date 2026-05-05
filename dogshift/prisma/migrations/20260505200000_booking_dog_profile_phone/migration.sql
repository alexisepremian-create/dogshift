-- AlterTable: add dog profile and owner phone to bookings
ALTER TABLE "Booking" ADD COLUMN "dogProfileId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "ownerPhone" TEXT;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dogProfileId_fkey"
  FOREIGN KEY ("dogProfileId") REFERENCES "DogProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Booking_dogProfileId_idx" ON "Booking"("dogProfileId");
