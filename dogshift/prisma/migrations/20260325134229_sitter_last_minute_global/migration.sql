-- AlterTable
ALTER TABLE "SitterProfile" ADD COLUMN     "lastMinuteEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from per-service configuration (legacy).
UPDATE "SitterProfile" sp
SET "lastMinuteEnabled" = TRUE
WHERE EXISTS (
  SELECT 1
  FROM "ServiceConfig" sc
  WHERE sc."sitterId" = sp."sitterId"
    AND sc."lastMinuteEnabled" = TRUE
);
