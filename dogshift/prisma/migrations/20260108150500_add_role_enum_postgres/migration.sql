-- Ensure Postgres enum type exists for Prisma Role
DO $$
BEGIN
  CREATE TYPE "Role" AS ENUM ('OWNER', 'SITTER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Convert existing column to enum (was TEXT in initial migrations)
ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role" USING ("role"::"Role");

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'OWNER'::"Role";
