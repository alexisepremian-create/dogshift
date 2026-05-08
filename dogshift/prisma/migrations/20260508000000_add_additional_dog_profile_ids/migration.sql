-- AlterTable: add additionalDogProfileIds column to Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "additionalDogProfileIds" TEXT;
