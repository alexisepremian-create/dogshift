-- Add a new admin-only application status for pre-onboarding activation.
-- Safe for Postgres: IF NOT EXISTS avoids errors when re-applying.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'SitterApplicationStatus' AND e.enumlabel = 'ACTIVATED'
  ) THEN
    ALTER TYPE "SitterApplicationStatus" ADD VALUE 'ACTIVATED';
  END IF;
END $$;

