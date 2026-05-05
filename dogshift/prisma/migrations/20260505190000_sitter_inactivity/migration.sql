-- Inactivity tracking for published sitters with no availability set
ALTER TABLE "SitterProfile"
  ADD COLUMN IF NOT EXISTS "inactivityStatus"     TEXT,
  ADD COLUMN IF NOT EXISTS "inactivityNudgeAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "inactivityWarning1At" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "inactivityWarning2At" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "inactivitySuspendedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "SitterProfile_inactivityStatus_idx" ON "SitterProfile"("inactivityStatus");
