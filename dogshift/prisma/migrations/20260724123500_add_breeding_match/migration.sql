-- CreateEnum
CREATE TYPE "DogSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "SwipeDirection" AS ENUM ('LIKE', 'PASS');

-- CreateEnum
CREATE TYPE "MatingGoal" AS ENUM ('LITTER', 'STUD', 'EXPLORING');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'newMatch';

-- AlterTable
ALTER TABLE "DogProfile" ADD COLUMN IF NOT EXISTS "sex" "DogSex";

-- CreateTable
CREATE TABLE "MatingProfile" (
    "id" TEXT NOT NULL,
    "dogProfileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "goal" "MatingGoal" NOT NULL DEFAULT 'EXPLORING',
    "bio" TEXT,
    "region" TEXT,
    "acceptedTermsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swipe" (
    "id" TEXT NOT NULL,
    "swiperDogId" TEXT NOT NULL,
    "targetDogId" TEXT NOT NULL,
    "direction" "SwipeDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Swipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "dogAId" TEXT NOT NULL,
    "dogBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchThread" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatingProfile_dogProfileId_key" ON "MatingProfile"("dogProfileId");

-- CreateIndex
CREATE INDEX "MatingProfile_userId_idx" ON "MatingProfile"("userId");

-- CreateIndex
CREATE INDEX "MatingProfile_enabled_idx" ON "MatingProfile"("enabled");

-- CreateIndex
CREATE INDEX "Swipe_targetDogId_direction_idx" ON "Swipe"("targetDogId", "direction");

-- CreateIndex
CREATE INDEX "Swipe_swiperDogId_idx" ON "Swipe"("swiperDogId");

-- CreateIndex
CREATE UNIQUE INDEX "Swipe_swiperDogId_targetDogId_key" ON "Swipe"("swiperDogId", "targetDogId");

-- CreateIndex
CREATE INDEX "Match_dogAId_idx" ON "Match"("dogAId");

-- CreateIndex
CREATE INDEX "Match_dogBId_idx" ON "Match"("dogBId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_dogAId_dogBId_key" ON "Match"("dogAId", "dogBId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchThread_matchId_key" ON "MatchThread"("matchId");

-- CreateIndex
CREATE INDEX "MatchThread_lastMessageAt_idx" ON "MatchThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "MatchMessage_threadId_idx" ON "MatchMessage"("threadId");

-- CreateIndex
CREATE INDEX "MatchMessage_senderId_idx" ON "MatchMessage"("senderId");

-- CreateIndex
CREATE INDEX "MatchMessage_createdAt_idx" ON "MatchMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "MatingProfile" ADD CONSTRAINT "MatingProfile_dogProfileId_fkey" FOREIGN KEY ("dogProfileId") REFERENCES "DogProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_swiperDogId_fkey" FOREIGN KEY ("swiperDogId") REFERENCES "MatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swipe" ADD CONSTRAINT "Swipe_targetDogId_fkey" FOREIGN KEY ("targetDogId") REFERENCES "MatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_dogAId_fkey" FOREIGN KEY ("dogAId") REFERENCES "MatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_dogBId_fkey" FOREIGN KEY ("dogBId") REFERENCES "MatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchThread" ADD CONSTRAINT "MatchThread_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchMessage" ADD CONSTRAINT "MatchMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MatchThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchMessage" ADD CONSTRAINT "MatchMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

