-- Add Clerk stable identifier on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clerkUserId" TEXT;

-- Ensure uniqueness (nullable unique is allowed in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS "User_clerkUserId_key" ON "User"("clerkUserId");
