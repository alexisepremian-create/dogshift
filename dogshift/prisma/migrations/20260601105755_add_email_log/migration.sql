-- Append-only audit log of every transactional email the platform sends.
-- IF NOT EXISTS variants used everywhere because Vercel has historically
-- skipped Prisma migrations silently on this project (see
-- docs/bugs/prisma-migration-not-applied-on-prod.md), so a re-run is safe.

CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id"           TEXT NOT NULL,
  "to"           TEXT NOT NULL,
  "fromAddress"  TEXT,
  "subject"      TEXT NOT NULL,
  "templateName" TEXT,
  "context"      TEXT,
  "status"       TEXT NOT NULL,
  "mode"         TEXT,
  "messageId"    TEXT,
  "errorMessage" TEXT,
  "targetUserId" TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailLog_to_createdAt_idx"           ON "EmailLog"("to", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_templateName_createdAt_idx" ON "EmailLog"("templateName", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_status_createdAt_idx"       ON "EmailLog"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_targetUserId_createdAt_idx" ON "EmailLog"("targetUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx"              ON "EmailLog"("createdAt");
