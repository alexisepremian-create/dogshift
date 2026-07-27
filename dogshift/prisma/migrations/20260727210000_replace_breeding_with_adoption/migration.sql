-- Replace the breeding-match feature with the dog-adoption feature.
--
-- The breeding feature never left the pilot, so the tables are dropped outright
-- rather than migrated. Adoption reuses only the DogSex enum.

-- ── 1. Drop the breeding feature ────────────────────────────────────────────
DROP TABLE IF EXISTS "MatchMessage";
DROP TABLE IF EXISTS "MatchThread";
DROP TABLE IF EXISTS "Match";
DROP TABLE IF EXISTS "Swipe";
DROP TABLE IF EXISTS "MatingProfile";

DROP TYPE IF EXISTS "SwipeDirection";
DROP TYPE IF EXISTS "MatingGoal";

-- ── 2. Notification types: drop `newMatch`, add the adoption ones ───────────
DELETE FROM "Notification" WHERE "type" = 'newMatch';

ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";

CREATE TYPE "NotificationType" AS ENUM (
  'newMessages',
  'newBookingRequest',
  'paymentReceived',
  'bookingConfirmed',
  'bookingReminder',
  'serviceReportSelfie',
  'serviceReportReminder',
  'serviceReportReceived',
  'adoptionApplicationReceived',
  'adoptionApplicationAccepted',
  'adoptionApplicationDeclined',
  'adoptionMessage',
  'adoptionListingFreshness',
  'adoptionSearchAlert',
  'adoptionAmicusReminder',
  'adoptionCheckIn'
);

ALTER TABLE "Notification"
  ALTER COLUMN "type" TYPE "NotificationType"
  USING ("type"::text::"NotificationType");

DROP TYPE "NotificationType_old";

-- ── 3. Adoption enums ───────────────────────────────────────────────────────
CREATE TYPE "DogSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'GIANT');

CREATE TYPE "AdoptionListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PENDING', 'ADOPTED', 'ARCHIVED');

CREATE TYPE "DogProvenance" AS ENUM (
  'PRIVATE_OWNER',
  'SWISS_BREEDER',
  'SWISS_SHELTER',
  'FOREIGN_SHELTER',
  'FOREIGN_BREEDER',
  'FOUND_STRAY',
  'OTHER'
);

CREATE TYPE "AdoptionApplicationStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TYPE "HousingType" AS ENUM ('APARTMENT', 'HOUSE', 'FARM');

CREATE TYPE "RescueOrgStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- ── 4. RescueOrganization ───────────────────────────────────────────────────
CREATE TABLE "RescueOrganization" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "RescueOrgStatus" NOT NULL DEFAULT 'PENDING',
  "cantonalAuthNumber" TEXT,
  "websiteUrl" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "postalCode" TEXT,
  "city" TEXT,
  "canton" TEXT,
  "logoUrl" TEXT,
  "description" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "rejectedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RescueOrganization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RescueOrganization_userId_key" ON "RescueOrganization"("userId");
CREATE INDEX "RescueOrganization_status_idx" ON "RescueOrganization"("status");

ALTER TABLE "RescueOrganization"
  ADD CONSTRAINT "RescueOrganization_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 5. AdoptionListing ──────────────────────────────────────────────────────
CREATE TABLE "AdoptionListing" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "status" "AdoptionListingStatus" NOT NULL DEFAULT 'DRAFT',
  "dogName" TEXT NOT NULL,
  "breed" TEXT,
  "secondaryBreed" TEXT,
  "isCrossbreed" BOOLEAN NOT NULL DEFAULT false,
  "sex" "DogSex" NOT NULL,
  "birthDate" TIMESTAMP(3) NOT NULL,
  "sizeCategory" "DogSize" NOT NULL,
  "weightKg" DOUBLE PRECISION,
  "neutered" BOOLEAN,
  "vaccinated" BOOLEAN,
  "dewormed" BOOLEAN,
  "microchipNumber" TEXT,
  "provenance" "DogProvenance" NOT NULL,
  "breedingCountry" TEXT NOT NULL,
  "cedantFullName" TEXT NOT NULL,
  "cedantAddress" TEXT NOT NULL,
  "cedantPostalCode" TEXT NOT NULL,
  "cedantCity" TEXT NOT NULL,
  "feeAmount" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "description" TEXT NOT NULL,
  "idealHome" TEXT,
  "goodWithChildren" BOOLEAN,
  "goodWithDogs" BOOLEAN,
  "goodWithCats" BOOLEAN,
  "houseTrained" BOOLEAN,
  "energyLevel" INTEGER,
  "specialNeeds" TEXT,
  "canton" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "photos" TEXT[],
  "publishedAt" TIMESTAMP(3),
  "lastConfirmedAt" TIMESTAMP(3),
  "adoptedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "acceptedTermsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdoptionListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdoptionListing_status_publishedAt_idx" ON "AdoptionListing"("status", "publishedAt");
CREATE INDEX "AdoptionListing_userId_idx" ON "AdoptionListing"("userId");
CREATE INDEX "AdoptionListing_canton_idx" ON "AdoptionListing"("canton");
CREATE INDEX "AdoptionListing_organizationId_idx" ON "AdoptionListing"("organizationId");

ALTER TABLE "AdoptionListing"
  ADD CONSTRAINT "AdoptionListing_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdoptionListing"
  ADD CONSTRAINT "AdoptionListing_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "RescueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 6. AdopterProfile ───────────────────────────────────────────────────────
CREATE TABLE "AdopterProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "housingType" "HousingType" NOT NULL,
  "isHomeOwner" BOOLEAN NOT NULL,
  "landlordApproval" BOOLEAN,
  "hasGarden" BOOLEAN NOT NULL DEFAULT false,
  "gardenFenced" BOOLEAN,
  "householdAdults" INTEGER NOT NULL DEFAULT 1,
  "householdChildren" INTEGER NOT NULL DEFAULT 0,
  "youngestChildAge" INTEGER,
  "hasOtherDogs" BOOLEAN NOT NULL DEFAULT false,
  "hasCats" BOOLEAN NOT NULL DEFAULT false,
  "otherPetsNote" TEXT,
  "hoursAlonePerDay" INTEGER,
  "experienceLevel" INTEGER NOT NULL,
  "previousDogsNote" TEXT,
  "activityLevel" INTEGER,
  "canton" TEXT,
  "city" TEXT,
  "motivation" TEXT,
  "consentSharedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdopterProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdopterProfile_userId_key" ON "AdopterProfile"("userId");

ALTER TABLE "AdopterProfile"
  ADD CONSTRAINT "AdopterProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 7. AdoptionApplication ──────────────────────────────────────────────────
CREATE TABLE "AdoptionApplication" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AdoptionApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "answers" JSONB,
  "respondedAt" TIMESTAMP(3),
  "declineReason" TEXT,
  "withdrawnAt" TIMESTAMP(3),
  "adoptedAt" TIMESTAMP(3),
  "amicusConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdoptionApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdoptionApplication_listingId_userId_key" ON "AdoptionApplication"("listingId", "userId");
CREATE INDEX "AdoptionApplication_listingId_status_idx" ON "AdoptionApplication"("listingId", "status");
CREATE INDEX "AdoptionApplication_userId_idx" ON "AdoptionApplication"("userId");

ALTER TABLE "AdoptionApplication"
  ADD CONSTRAINT "AdoptionApplication_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "AdoptionListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdoptionApplication"
  ADD CONSTRAINT "AdoptionApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 8. AdoptionThread + AdoptionMessage ─────────────────────────────────────
CREATE TABLE "AdoptionThread" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "lastMessageAt" TIMESTAMP(3),
  "lastMessagePreview" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdoptionThread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdoptionThread_applicationId_key" ON "AdoptionThread"("applicationId");
CREATE INDEX "AdoptionThread_lastMessageAt_idx" ON "AdoptionThread"("lastMessageAt");

ALTER TABLE "AdoptionThread"
  ADD CONSTRAINT "AdoptionThread_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "AdoptionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdoptionMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdoptionMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdoptionMessage_threadId_idx" ON "AdoptionMessage"("threadId");
CREATE INDEX "AdoptionMessage_senderId_idx" ON "AdoptionMessage"("senderId");
CREATE INDEX "AdoptionMessage_createdAt_idx" ON "AdoptionMessage"("createdAt");

ALTER TABLE "AdoptionMessage"
  ADD CONSTRAINT "AdoptionMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "AdoptionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdoptionMessage"
  ADD CONSTRAINT "AdoptionMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 9. AdoptionSavedSearch ──────────────────────────────────────────────────
CREATE TABLE "AdoptionSavedSearch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT,
  "filters" JSONB NOT NULL,
  "alertsOn" BOOLEAN NOT NULL DEFAULT true,
  "lastNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdoptionSavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdoptionSavedSearch_userId_idx" ON "AdoptionSavedSearch"("userId");
CREATE INDEX "AdoptionSavedSearch_alertsOn_idx" ON "AdoptionSavedSearch"("alertsOn");

ALTER TABLE "AdoptionSavedSearch"
  ADD CONSTRAINT "AdoptionSavedSearch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
