#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * One-shot: geocode every published SitterProfile whose lat/lng is NULL.
 *
 * Triggered by the nightly bug-regression-check cron flagging the
 * `penthaz-geocoding` fiche (SQL probe counted > 0 missing-GPS sitters).
 * The admin endpoint POST /api/admin/geocode-sitters does the same thing
 * but requires the admin gate; this script is the local-env equivalent
 * for ops use.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/brain/fix-missing-sitter-geocoding.ts
 *
 * Requires: DATABASE_URL, NEXT_PUBLIC_MAPTILER_KEY
 */
import { PrismaClient } from "@prisma/client";
import { geocodeSwissLocation } from "../../lib/geocode";

const prisma = new PrismaClient();

async function main() {
  const profiles = (await (prisma as any).sitterProfile.findMany({
    where: {
      published: true,
      OR: [{ lat: null }, { lng: null }],
    },
    select: {
      id: true,
      sitterId: true,
      displayName: true,
      city: true,
      postalCode: true,
    },
  })) as Array<{
    id: string;
    sitterId: string | null;
    displayName: string | null;
    city: string | null;
    postalCode: string | null;
  }>;

  console.log(`Found ${profiles.length} published sitter(s) with NULL lat/lng`);

  let geocoded = 0;
  let failed = 0;

  for (const p of profiles) {
    const city = (p.city ?? "").trim();
    const postalCode = (p.postalCode ?? "").trim();
    const label = `${p.displayName ?? p.sitterId} (${city || "?"} ${postalCode || "?"})`;

    if (!city && !postalCode) {
      console.warn(`  ⏭  ${label} — no city/postalCode, skipping`);
      failed++;
      continue;
    }

    const coords = await geocodeSwissLocation({ city, postalCode });
    if (!coords) {
      console.error(`  ❌  ${label} — geocoding failed`);
      failed++;
      continue;
    }

    await (prisma as any).sitterProfile.update({
      where: { id: p.id },
      data: { lat: coords.lat, lng: coords.lng },
    });
    console.log(`  ✓  ${label} → lat=${coords.lat.toFixed(4)}, lng=${coords.lng.toFixed(4)}`);
    geocoded++;
  }

  console.log(`\n✨ Done. Geocoded ${geocoded}, failed ${failed}.`);
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
