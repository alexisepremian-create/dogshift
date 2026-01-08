-- Booking internal checkout migration
-- Goals:
-- 1) map old Booking.status values to new lifecycle
--    PENDING   -> PENDING_PAYMENT
--    CANCELED  -> CANCELLED
--    PAID      -> PAID
-- 2) add new booking fields used by internal checkout
-- 3) keep existing rows

-- Add new booking fields used by internal checkout
ALTER TABLE "Booking" ADD COLUMN "service" TEXT;
ALTER TABLE "Booking" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "endDate" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "message" TEXT;

-- Map old Booking.status values to new lifecycle
UPDATE "Booking"
SET "status" = CASE "status"
  WHEN 'PENDING' THEN 'PENDING_PAYMENT'
  WHEN 'CANCELED' THEN 'CANCELLED'
  WHEN 'PAID' THEN 'PAID'
  ELSE 'PENDING_PAYMENT'
END;

-- Update default status for new rows
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
