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

-- Drop legacy TEXT default before casting (required by Postgres)
ALTER TABLE "Booking" ALTER COLUMN "status" DROP DEFAULT;

-- Normalize legacy values before the cast
UPDATE "Booking"
SET "status" = 'PENDING_PAYMENT'
WHERE "status" IS NULL;

UPDATE "Booking"
SET "status" = 'CANCELLED'
WHERE "status" = 'CANCELED';

UPDATE "Booking"
SET "status" = 'PENDING_PAYMENT'
WHERE "status" = 'PENDING';

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

-- Restore default after cast
ALTER TABLE "Booking"
  ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
