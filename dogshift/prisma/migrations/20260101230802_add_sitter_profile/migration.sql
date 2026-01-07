-- CreateTable
CREATE TABLE "SitterProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sitterId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "displayName" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "lat" REAL,
    "lng" REAL,
    "services" JSONB,
    "pricing" JSONB,
    "dogSizes" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SitterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SitterProfile_userId_key" ON "SitterProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SitterProfile_sitterId_key" ON "SitterProfile"("sitterId");

-- CreateIndex
CREATE INDEX "SitterProfile_published_idx" ON "SitterProfile"("published");

-- CreateIndex
CREATE INDEX "SitterProfile_city_idx" ON "SitterProfile"("city");

-- CreateIndex
CREATE INDEX "SitterProfile_postalCode_idx" ON "SitterProfile"("postalCode");
