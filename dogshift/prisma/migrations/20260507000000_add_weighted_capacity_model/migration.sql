-- Add weighted capacity model columns
ALTER TABLE "SitterProfile" ADD COLUMN "capacityPlaces" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SitterProfile" ADD COLUMN "acceptsSmall" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SitterProfile" ADD COLUMN "acceptsMedium" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SitterProfile" ADD COLUMN "acceptsLarge" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SitterProfile" ADD COLUMN "neuteredRequired" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing data from JSON fields to new columns.
-- Step 1: acceptsSmall/Medium/Large from maxDogsBySize or dogSizes
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

-- Step 2: capacityPlaces from maxDogsBySize weighted sum, clamped to [1, 15]
UPDATE "SitterProfile"
SET "capacityPlaces" = LEAST(15, GREATEST(1,
  COALESCE((("maxDogsBySize"::jsonb)->>'Petit')::int, 0) * 1 +
  COALESCE((("maxDogsBySize"::jsonb)->>'Moyen')::int, 0) * 2 +
  COALESCE((("maxDogsBySize"::jsonb)->>'Grand')::int, 0) * 3
))
WHERE "maxDogsBySize" IS NOT NULL;

-- Step 3: If acceptanceCriteria.maxDogs exists and is lower, use it as the capacity
UPDATE "SitterProfile"
SET "capacityPlaces" = LEAST(15, GREATEST(1, (("acceptanceCriteria"::jsonb)->>'maxDogs')::int))
WHERE "acceptanceCriteria" IS NOT NULL
  AND ("acceptanceCriteria"::jsonb)->>'maxDogs' IS NOT NULL
  AND (("acceptanceCriteria"::jsonb)->>'maxDogs')::int > 0
  AND (("acceptanceCriteria"::jsonb)->>'maxDogs')::int < "capacityPlaces";

-- Step 4: neuteredRequired from acceptanceCriteria
UPDATE "SitterProfile"
SET "neuteredRequired" = COALESCE(
  (("acceptanceCriteria"::jsonb)->>'neuteredRequired')::boolean,
  false
)
WHERE "acceptanceCriteria" IS NOT NULL
  AND ("acceptanceCriteria"::jsonb)->>'neuteredRequired' IS NOT NULL;
