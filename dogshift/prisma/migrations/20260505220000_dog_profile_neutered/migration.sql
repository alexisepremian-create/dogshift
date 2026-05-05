-- Add neutered/spayed status to DogProfile for sitter acceptance criteria validation
ALTER TABLE "DogProfile"
  ADD COLUMN IF NOT EXISTS "neutered" BOOLEAN;
