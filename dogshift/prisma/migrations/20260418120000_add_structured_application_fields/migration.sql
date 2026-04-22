-- Additive migration: adds structured fields to PilotSitterApplication
-- All new columns are nullable or have safe defaults to preserve backward
-- compatibility with previously submitted pilot applications.

ALTER TABLE "PilotSitterApplication"
  ADD COLUMN "npa" TEXT,
  ADD COLUMN "cityOther" TEXT,
  ADD COLUMN "linkAnimalProfession" TEXT,
  ADD COLUMN "linkAnimalProfessionOther" TEXT,
  ADD COLUMN "gardeExperienceLevel" TEXT,
  ADD COLUMN "availabilityStructured" JSONB,
  ADD COLUMN "gardeTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dogSizes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "housingType" TEXT,
  ADD COLUMN "housingTypeOther" TEXT,
  ADD COLUMN "otherAnimals" JSONB,
  ADD COLUMN "otherAnimalsDogCount" INTEGER,
  ADD COLUMN "hasCarLicense" BOOLEAN,
  ADD COLUMN "allergies" TEXT;

-- Helpful index for filtering applications by city dropdown value.
CREATE INDEX "PilotSitterApplication_city_status_idx"
  ON "PilotSitterApplication" ("city", "status");
