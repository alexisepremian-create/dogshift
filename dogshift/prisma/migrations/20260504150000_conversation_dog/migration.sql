-- Add dogProfileId to Conversation (nullable, ON DELETE SET NULL)
ALTER TABLE "Conversation" ADD COLUMN "dogProfileId" TEXT;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dogProfileId_fkey"
  FOREIGN KEY ("dogProfileId") REFERENCES "DogProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
