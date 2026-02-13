-- Availability: store availability as dateKey (YYYY-MM-DD) instead of DateTime to avoid timezone issues.

-- Drop old indexes
DROP INDEX IF EXISTS "Availability_sitterId_date_idx";
DROP INDEX IF EXISTS "Availability_sitterId_date_key";

-- Add new column (nullable for backfill)
ALTER TABLE "Availability" ADD COLUMN IF NOT EXISTS "dateKey" TEXT;

-- Backfill from date (UTC timestamp) to YYYY-MM-DD
UPDATE "Availability" SET "dateKey" = to_char("date"::date, 'YYYY-MM-DD') WHERE "dateKey" IS NULL;

-- Make column required
ALTER TABLE "Availability" ALTER COLUMN "dateKey" SET NOT NULL;

-- Drop old date column
ALTER TABLE "Availability" DROP COLUMN IF EXISTS "date";

-- Create new indexes
CREATE UNIQUE INDEX "Availability_sitterId_dateKey_key" ON "Availability"("sitterId", "dateKey");
CREATE INDEX "Availability_sitterId_dateKey_idx" ON "Availability"("sitterId", "dateKey");
