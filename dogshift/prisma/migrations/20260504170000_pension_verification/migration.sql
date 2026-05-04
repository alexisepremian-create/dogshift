ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionVerifStatus" TEXT NOT NULL DEFAULT 'not_submitted';
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionPhotoUrls" JSONB;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionPhotoSubmittedAt" TIMESTAMP(3);
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionPhotoReviewedAt" TIMESTAMP(3);
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionAiScore" DOUBLE PRECISION;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionAiVerdict" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionAiReasoning" JSONB;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionAiReviewedAt" TIMESTAMP(3);
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionAdminNotes" TEXT;
CREATE INDEX IF NOT EXISTS "SitterProfile_pensionVerifStatus_idx" ON "SitterProfile"("pensionVerifStatus");

-- Legacy sitters: anyone who has Pension enabled in their services JSON already
UPDATE "SitterProfile"
SET "pensionVerifStatus" = 'legacy_pending'
WHERE (services::jsonb->>'Pension')::boolean = true
  AND "pensionVerifStatus" = 'not_submitted';
