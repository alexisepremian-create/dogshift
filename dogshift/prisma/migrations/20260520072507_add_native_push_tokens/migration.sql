-- Native push tokens (iOS APNs + Android FCM) for the Capacitor app.
-- Separate from web push (PushSubscription) so the two flows can coexist.

DO $$ BEGIN
  CREATE TYPE "NativePushPlatform" AS ENUM ('ios', 'android');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "native_push_tokens" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "platform"      "NativePushPlatform" NOT NULL,
  "token"         TEXT NOT NULL,
  "bundleId"      TEXT,
  "invalidatedAt" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "native_push_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "native_push_tokens_token_key" ON "native_push_tokens"("token");
CREATE INDEX IF NOT EXISTS "native_push_tokens_userId_idx" ON "native_push_tokens"("userId");
CREATE INDEX IF NOT EXISTS "native_push_tokens_platform_idx" ON "native_push_tokens"("platform");

ALTER TABLE "native_push_tokens"
  ADD CONSTRAINT "native_push_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
