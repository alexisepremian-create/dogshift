-- Ensure Postgres enum type exists for Prisma BookingStatus
DO $$
BEGIN
  CREATE TYPE "BookingStatus" AS ENUM (
    'DRAFT',
    'PENDING_PAYMENT',
    'PENDING_ACCEPTANCE',
    'PAID',
    'CONFIRMED',
    'PAYMENT_FAILED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Normalize legacy TEXT statuses (in case previous migrations were not applied)
UPDATE "Booking"
SET "status" = CASE "status"
  WHEN 'PENDING' THEN 'PENDING_PAYMENT'
  WHEN 'CANCELED' THEN 'CANCELLED'
  ELSE "status"
END;

-- Fallback: any unexpected value becomes PENDING_PAYMENT to allow cast
UPDATE "Booking"
SET "status" = 'PENDING_PAYMENT'
WHERE "status" NOT IN (
  'DRAFT',
  'PENDING_PAYMENT',
  'PENDING_ACCEPTANCE',
  'PAID',
  'CONFIRMED',
  'PAYMENT_FAILED',
  'CANCELLED'
);

-- Convert existing column to enum (was TEXT in initial migrations)
ALTER TABLE "Booking"
  ALTER COLUMN "status" TYPE "BookingStatus" USING ("status"::"BookingStatus");

ALTER TABLE "Booking"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
