DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractAmendmentStatus') THEN
    CREATE TYPE "ContractAmendmentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');
  END IF;
END
$$;

ALTER TABLE "ContractAmendment"
  ADD COLUMN IF NOT EXISTS "status" "ContractAmendmentStatus";

UPDATE "ContractAmendment"
SET "status" = CASE WHEN COALESCE("isActive", false) THEN 'ACTIVE'::"ContractAmendmentStatus" ELSE 'INACTIVE'::"ContractAmendmentStatus" END
WHERE "status" IS NULL;

ALTER TABLE "ContractAmendment"
  ALTER COLUMN "status" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ContractAmendment_status_createdAt_idx"
  ON "ContractAmendment" ("status", "createdAt");

