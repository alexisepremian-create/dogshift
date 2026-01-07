-- Add canceledAt timestamp to Booking (owner cancellation)

ALTER TABLE "Booking" ADD COLUMN "canceledAt" DATETIME;
