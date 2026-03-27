DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ServiceCostType') THEN
    CREATE TYPE "ServiceCostType" AS ENUM ('hosting', 'db', 'payment', 'email', 'auth', 'other');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ServiceCostBillingType') THEN
    CREATE TYPE "ServiceCostBillingType" AS ENUM ('fixed', 'variable');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ServiceCost" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ServiceCostType" NOT NULL,
  "costType" "ServiceCostBillingType" NOT NULL,
  "monthlyCost" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "estimatedCostPerBooking" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceCost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceCost_active_createdAt_idx" ON "ServiceCost"("active", "createdAt");
CREATE INDEX IF NOT EXISTS "ServiceCost_type_createdAt_idx" ON "ServiceCost"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "ServiceCost_createdAt_idx" ON "ServiceCost"("createdAt");

