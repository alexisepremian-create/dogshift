-- ============================================================
-- DB REPAIR SCRIPT - Applies all blocked migrations safely
-- All statements use IF NOT EXISTS to be idempotent
-- ============================================================

-- 20260504080000_add_travel_fee
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "locationMode" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "travelDistanceKm" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "travelFeeAmount" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerLat" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerLng" DOUBLE PRECISION;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerAddress" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "address" TEXT;

-- 20260504120000_lead_nurturing
ALTER TABLE "LeadMagnet" ADD COLUMN IF NOT EXISTS "nurturingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadMagnet" ADD COLUMN IF NOT EXISTS "lastNurturingAt" TIMESTAMP(3);
ALTER TABLE "LeadMagnet" ADD COLUMN IF NOT EXISTS "unsubscribed" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "LeadMagnet_nurturingStep_capturedAt_idx" ON "LeadMagnet"("nurturingStep", "capturedAt");
CREATE INDEX IF NOT EXISTS "LeadMagnet_nurturingStep_lastNurturingAt_idx" ON "LeadMagnet"("nurturingStep", "lastNurturingAt");

-- 20260504140000_dog_profiles
CREATE TABLE IF NOT EXISTS "DogProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "birthYear" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "medications" TEXT,
    "allergies" TEXT,
    "vetContact" TEXT,
    "behaviorNotes" TEXT,
    "feedingNotes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DogProfile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DogProfile_userId_idx" ON "DogProfile"("userId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DogProfile_userId_fkey'
  ) THEN
    ALTER TABLE "DogProfile" ADD CONSTRAINT "DogProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "maxDogsBySize" JSONB;

-- 20260504150000_conversation_dog
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "dogProfileId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Conversation_dogProfileId_fkey'
  ) THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dogProfileId_fkey"
      FOREIGN KEY ("dogProfileId") REFERENCES "DogProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 20260504160000_dog_photo
ALTER TABLE "DogProfile" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "DogProfile" ADD COLUMN IF NOT EXISTS "sitterInstructions" TEXT;

-- 20260504170000_pension_verification
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

-- 20260505180000_pension_accepted_sizes
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "pensionAcceptedSizes" JSONB;

-- 20260505190000_sitter_inactivity
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "inactivityStatus" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "inactivityNudgeAt" TIMESTAMPTZ;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "inactivityWarning1At" TIMESTAMPTZ;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "inactivityWarning2At" TIMESTAMPTZ;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "inactivitySuspendedAt" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "SitterProfile_inactivityStatus_idx" ON "SitterProfile"("inactivityStatus");

-- 20260505200000_booking_dog_profile_phone
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "dogProfileId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "ownerPhone" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Booking_dogProfileId_fkey'
  ) THEN
    ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dogProfileId_fkey"
      FOREIGN KEY ("dogProfileId") REFERENCES "DogProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS "Booking_dogProfileId_idx" ON "Booking"("dogProfileId");

-- 20260505200000_sitter_acceptance_criteria
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "acceptanceCriteria" JSONB;

-- 20260505210000_max_dogs_cert
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "maxDogsCertVerifStatus" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "maxDogsCertPhotoKey" TEXT;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "maxDogsCertSubmittedAt" TIMESTAMPTZ;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "maxDogsCertReviewedAt" TIMESTAMPTZ;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "maxDogsCertAdminNotes" TEXT;
CREATE INDEX IF NOT EXISTS "SitterProfile_maxDogsCertVerifStatus_idx" ON "SitterProfile"("maxDogsCertVerifStatus");

-- 20260505220000_dog_profile_neutered
ALTER TABLE "DogProfile" ADD COLUMN IF NOT EXISTS "neutered" BOOLEAN;

-- 20260507000000_add_weighted_capacity_model
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "capacityPlaces" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "acceptsSmall" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "acceptsMedium" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "acceptsLarge" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SitterProfile" ADD COLUMN IF NOT EXISTS "neuteredRequired" BOOLEAN NOT NULL DEFAULT false;

-- Migrate capacity data from old fields
UPDATE "SitterProfile"
SET
  "acceptsSmall" = CASE
    WHEN "maxDogsBySize" IS NOT NULL AND ("maxDogsBySize"::jsonb)->>'Petit' IS NOT NULL
      THEN (("maxDogsBySize"::jsonb)->>'Petit')::int > 0
    WHEN "dogSizes" IS NOT NULL AND jsonb_typeof("dogSizes"::jsonb) = 'array'
      THEN "dogSizes"::jsonb ? 'Petit'
    WHEN "dogSizes" IS NOT NULL AND jsonb_typeof("dogSizes"::jsonb) = 'object'
      THEN COALESCE(("dogSizes"::jsonb)->>'Petit' = 'true', false)
    ELSE true
  END,
  "acceptsMedium" = CASE
    WHEN "maxDogsBySize" IS NOT NULL AND ("maxDogsBySize"::jsonb)->>'Moyen' IS NOT NULL
      THEN (("maxDogsBySize"::jsonb)->>'Moyen')::int > 0
    WHEN "dogSizes" IS NOT NULL AND jsonb_typeof("dogSizes"::jsonb) = 'array'
      THEN "dogSizes"::jsonb ? 'Moyen'
    WHEN "dogSizes" IS NOT NULL AND jsonb_typeof("dogSizes"::jsonb) = 'object'
      THEN COALESCE(("dogSizes"::jsonb)->>'Moyen' = 'true', false)
    ELSE true
  END,
  "acceptsLarge" = CASE
    WHEN "maxDogsBySize" IS NOT NULL AND ("maxDogsBySize"::jsonb)->>'Grand' IS NOT NULL
      THEN (("maxDogsBySize"::jsonb)->>'Grand')::int > 0
    WHEN "dogSizes" IS NOT NULL AND jsonb_typeof("dogSizes"::jsonb) = 'array'
      THEN "dogSizes"::jsonb ? 'Grand'
    WHEN "dogSizes" IS NOT NULL AND jsonb_typeof("dogSizes"::jsonb) = 'object'
      THEN COALESCE(("dogSizes"::jsonb)->>'Grand' = 'true', false)
    ELSE true
  END
WHERE "maxDogsBySize" IS NOT NULL OR "dogSizes" IS NOT NULL;

UPDATE "SitterProfile"
SET "capacityPlaces" = LEAST(15, GREATEST(1,
  COALESCE((("maxDogsBySize"::jsonb)->>'Petit')::int, 0) * 1 +
  COALESCE((("maxDogsBySize"::jsonb)->>'Moyen')::int, 0) * 2 +
  COALESCE((("maxDogsBySize"::jsonb)->>'Grand')::int, 0) * 3
))
WHERE "maxDogsBySize" IS NOT NULL;

UPDATE "SitterProfile"
SET "capacityPlaces" = LEAST(15, GREATEST(1, (("acceptanceCriteria"::jsonb)->>'maxDogs')::int))
WHERE "acceptanceCriteria" IS NOT NULL
  AND ("acceptanceCriteria"::jsonb)->>'maxDogs' IS NOT NULL
  AND (("acceptanceCriteria"::jsonb)->>'maxDogs')::int > 0
  AND (("acceptanceCriteria"::jsonb)->>'maxDogs')::int < "capacityPlaces";

UPDATE "SitterProfile"
SET "neuteredRequired" = COALESCE(
  (("acceptanceCriteria"::jsonb)->>'neuteredRequired')::boolean,
  false
)
WHERE "acceptanceCriteria" IS NOT NULL
  AND ("acceptanceCriteria"::jsonb)->>'neuteredRequired' IS NOT NULL;
