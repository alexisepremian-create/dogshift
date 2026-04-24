-- Additive migration: introduces a tracked expiry for sitter activation codes
-- and a unique index on the hash so two sitters can never end up sharing an
-- active activation code. All columns remain nullable for backward
-- compatibility with existing rows that never had a code issued.

ALTER TABLE "SitterProfile"
  ADD COLUMN "activationCodeExpiresAt" TIMESTAMP(3);

-- Unique on hash (not on raw code — we never persist the plaintext code).
-- Postgres UNIQUE allows multiple NULLs by default, so sitters without an
-- issued code keep coexisting; once a hash is set, it must be distinct.
CREATE UNIQUE INDEX IF NOT EXISTS "SitterProfile_activationCodeHash_key"
  ON "SitterProfile"("activationCodeHash");
