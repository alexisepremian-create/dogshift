-- Soft-delete flag for owner bookings: hides a booking from the owner's list
-- forever while keeping the row (and its immutable finance/audit records) in DB.
ALTER TABLE "Booking" ADD COLUMN "deletedAt" TIMESTAMP(3);
