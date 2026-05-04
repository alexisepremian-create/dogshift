-- CreateTable DogProfile
CREATE TABLE "DogProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "birthYear" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "medications" TEXT,
    "allergies" TEXT,
    "vetContact" TEXT,
    "behaviorNotes" TEXT,
    "feedingNotes" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DogProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DogProfile_userId_idx" ON "DogProfile"("userId");

-- AddForeignKey
ALTER TABLE "DogProfile" ADD CONSTRAINT "DogProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable SitterProfile: add maxDogsBySize column
ALTER TABLE "SitterProfile" ADD COLUMN "maxDogsBySize" JSONB;
