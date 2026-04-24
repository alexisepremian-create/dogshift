-- Additive migration: adds per-candidate Calendly link + tracking of the
-- "HIGH / interview" email emission. All new columns are nullable so existing
-- rows remain valid.

ALTER TABLE "PilotSitterApplication"
  ADD COLUMN "calendlyLink" TEXT,
  ADD COLUMN "acceptedEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "acceptedEmailSource" TEXT;
