-- AlterTable: Add travel fee fields to Booking
ALTER TABLE "Booking" ADD COLUMN "locationMode" TEXT,
                      ADD COLUMN "travelDistanceKm" DOUBLE PRECISION,
                      ADD COLUMN "travelFeeAmount" INTEGER,
                      ADD COLUMN "ownerLat" DOUBLE PRECISION,
                      ADD COLUMN "ownerLng" DOUBLE PRECISION,
                      ADD COLUMN "ownerAddress" TEXT;

-- AlterTable: Add address field to SitterProfile
ALTER TABLE "SitterProfile" ADD COLUMN "address" TEXT;
