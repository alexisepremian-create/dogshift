-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SitterApplicationStatus') THEN
    CREATE TYPE "SitterApplicationStatus" AS ENUM ('PENDING', 'CONTACTED', 'ACCEPTED', 'REJECTED');
  END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PilotSitterApplication" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "age" INTEGER,
  "experienceText" TEXT NOT NULL,
  "hasDogExperience" BOOLEAN NOT NULL,
  "motivationText" TEXT NOT NULL,
  "availabilityText" TEXT NOT NULL,
  "consentInterview" BOOLEAN NOT NULL,
  "consentPrivacy" BOOLEAN NOT NULL,
  "status" "SitterApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmContent" TEXT,
  "utmTerm" TEXT,
  "referrer" TEXT,
  "userAgent" TEXT,
  "ip" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PilotSitterApplication_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PilotSitterApplication_createdAt_idx" ON "PilotSitterApplication"("createdAt");
CREATE INDEX IF NOT EXISTS "PilotSitterApplication_status_createdAt_idx" ON "PilotSitterApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PilotSitterApplication_email_createdAt_idx" ON "PilotSitterApplication"("email", "createdAt");

-- Unique constraint (idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'PilotSitterApplication_email_idempotencyKey_key'
  ) THEN
    ALTER TABLE "PilotSitterApplication"
      ADD CONSTRAINT "PilotSitterApplication_email_idempotencyKey_key" UNIQUE ("email", "idempotencyKey");
  END IF;
END$$;
