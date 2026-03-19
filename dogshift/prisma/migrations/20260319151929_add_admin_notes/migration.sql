-- CreateEnum
CREATE TYPE "AdminNoteTargetType" AS ENUM ('USER', 'BOOKING', 'PILOT_SITTER_APPLICATION', 'SITTER_PROFILE');

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL,
    "targetType" "AdminNoteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorClerkUserId" TEXT,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNote_targetType_targetId_createdAt_idx" ON "AdminNote"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_authorUserId_createdAt_idx" ON "AdminNote"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_authorClerkUserId_createdAt_idx" ON "AdminNote"("authorClerkUserId", "createdAt");
