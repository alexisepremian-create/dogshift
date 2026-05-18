-- Add postal address column to sitter applications.
-- Nullable for backward compat with applications submitted before this column existed.
-- The validator at lib/sitterApplication/schema.ts enforces it at the API layer
-- for all NEW applications.
ALTER TABLE "PilotSitterApplication" ADD COLUMN "address" TEXT;
