-- AlterTable: Add nurturing fields to LeadMagnet
ALTER TABLE "LeadMagnet"
  ADD COLUMN "nurturingStep"   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN "lastNurturingAt" TIMESTAMP(3),
  ADD COLUMN "unsubscribed"    BOOLEAN   NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "LeadMagnet_nurturingStep_capturedAt_idx" ON "LeadMagnet"("nurturingStep", "capturedAt");
CREATE INDEX "LeadMagnet_nurturingStep_lastNurturingAt_idx" ON "LeadMagnet"("nurturingStep", "lastNurturingAt");
