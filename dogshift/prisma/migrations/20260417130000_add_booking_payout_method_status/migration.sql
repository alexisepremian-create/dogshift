-- Add payout method/status for Stripe vs manual payouts
CREATE TYPE "BookingPayoutMethod" AS ENUM ('STRIPE', 'MANUAL');
CREATE TYPE "BookingPayoutStatus" AS ENUM ('PENDING', 'PAID');

ALTER TABLE "Booking"
ADD COLUMN "payoutMethod" "BookingPayoutMethod" NOT NULL DEFAULT 'STRIPE',
ADD COLUMN "payoutStatus" "BookingPayoutStatus" NOT NULL DEFAULT 'PENDING';
