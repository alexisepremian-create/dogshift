-- AlterTable: add soft-delete / archive / pin columns to Conversation
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "pinnedAt"   TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "deletedAt"  TIMESTAMP(3);
