CREATE TABLE "ContractAmendment" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SitterContractAmendmentAcceptance" (
  "id" TEXT NOT NULL,
  "amendmentId" TEXT NOT NULL,
  "sitterProfileId" TEXT NOT NULL,
  "amendmentVersion" TEXT NOT NULL,
  "amendmentTitle" TEXT NOT NULL,
  "amendmentContent" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SitterContractAmendmentAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractAmendment_version_key" ON "ContractAmendment"("version");
CREATE INDEX "ContractAmendment_isActive_createdAt_idx" ON "ContractAmendment"("isActive", "createdAt");
CREATE INDEX "ContractAmendment_createdAt_idx" ON "ContractAmendment"("createdAt");

CREATE UNIQUE INDEX "SitterContractAmendmentAcceptance_amendmentId_sitterProfileId_key" ON "SitterContractAmendmentAcceptance"("amendmentId", "sitterProfileId");
CREATE INDEX "SitterContractAmendmentAcceptance_sitterProfileId_acceptedAt_idx" ON "SitterContractAmendmentAcceptance"("sitterProfileId", "acceptedAt");
CREATE INDEX "SitterContractAmendmentAcceptance_amendmentId_acceptedAt_idx" ON "SitterContractAmendmentAcceptance"("amendmentId", "acceptedAt");

ALTER TABLE "SitterContractAmendmentAcceptance"
  ADD CONSTRAINT "SitterContractAmendmentAcceptance_amendmentId_fkey"
  FOREIGN KEY ("amendmentId") REFERENCES "ContractAmendment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SitterContractAmendmentAcceptance"
  ADD CONSTRAINT "SitterContractAmendmentAcceptance_sitterProfileId_fkey"
  FOREIGN KEY ("sitterProfileId") REFERENCES "SitterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
