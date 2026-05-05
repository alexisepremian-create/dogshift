-- OPAn art.101 certificate verification for sitters accepting >5 dogs simultaneously
ALTER TABLE "SitterProfile"
  ADD COLUMN IF NOT EXISTS "maxDogsCertVerifStatus"  TEXT,
  ADD COLUMN IF NOT EXISTS "maxDogsCertPhotoKey"     TEXT,
  ADD COLUMN IF NOT EXISTS "maxDogsCertSubmittedAt"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "maxDogsCertReviewedAt"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "maxDogsCertAdminNotes"   TEXT;

CREATE INDEX IF NOT EXISTS "SitterProfile_maxDogsCertVerifStatus_idx" ON "SitterProfile"("maxDogsCertVerifStatus");
