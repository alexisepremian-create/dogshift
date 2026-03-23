-- Ensure Postgres enum type exists for Prisma SitterLifecycleStatus
DO $$
BEGIN
  CREATE TYPE "SitterLifecycleStatus" AS ENUM ('application_received', 'selected', 'contract_to_sign', 'contract_signed', 'activated');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "SitterProfile"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "SitterLifecycleStatus" NOT NULL DEFAULT 'application_received',
  ADD COLUMN IF NOT EXISTS "contractVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "contractAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractSignerName" TEXT,
  ADD COLUMN IF NOT EXISTS "contractSignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractSignatureValue" TEXT,
  ADD COLUMN IF NOT EXISTS "contractSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "activationCodeHash" TEXT,
  ADD COLUMN IF NOT EXISTS "activationCodeIssuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activationCodeUsedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractAccessTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "contractAccessTokenIssuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractAccessTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contractAccessTokenUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SitterProfile_lifecycleStatus_idx" ON "SitterProfile"("lifecycleStatus");
