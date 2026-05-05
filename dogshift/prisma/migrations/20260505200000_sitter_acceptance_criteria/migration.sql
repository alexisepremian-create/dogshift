-- Global acceptance criteria for sitters (neutered required, max dogs, etc.)
ALTER TABLE "SitterProfile"
  ADD COLUMN IF NOT EXISTS "acceptanceCriteria" JSONB;
