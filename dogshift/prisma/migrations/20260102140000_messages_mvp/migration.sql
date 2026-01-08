-- Messages MVP: Conversation + Message tables

PRAGMA foreign_keys=OFF;

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ownerId" TEXT NOT NULL,
  "sitterId" TEXT NOT NULL,
  "bookingId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastMessagePreview" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Conversation_sitterId_fkey" FOREIGN KEY ("sitterId") REFERENCES "User" ("sitterId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Conversation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Conversation_ownerId_sitterId_key" ON "Conversation"("ownerId", "sitterId");
CREATE INDEX "Conversation_ownerId_idx" ON "Conversation"("ownerId");
CREATE INDEX "Conversation_sitterId_idx" ON "Conversation"("sitterId");
CREATE INDEX "Conversation_bookingId_idx" ON "Conversation"("bookingId");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
