-- Tinder-style breeding: geolocation + photo gallery on MatingProfile.
-- Additive & idempotent (safe to re-run; only touches MatingProfile).
ALTER TABLE "MatingProfile" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "MatingProfile" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE "MatingProfile" ADD COLUMN IF NOT EXISTS "locationLabel" TEXT;
ALTER TABLE "MatingProfile" ADD COLUMN IF NOT EXISTS "photos" TEXT[] NOT NULL DEFAULT '{}';
