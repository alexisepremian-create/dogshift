-- AlterEnum: add ADMIN to Role enum
-- Idempotent: only adds the value if it doesn't already exist (safe to re-run).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADMIN';
