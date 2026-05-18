#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * One-shot import of postal addresses for the pilot sitters.
 *
 * The current sitter onboarding flow does NOT collect the postal address
 * (only city + postal code). For the pilot sitters who joined before address
 * collection existed, the founder gathered the addresses manually and we
 * back-fill them here so:
 *   - the admin panel can display the address
 *   - the brain/ Obsidian export shows it
 *   - future features (route planning, sitter visit, Stripe Connect
 *     verification, contract regeneration) can rely on a populated field
 *
 * The address column already exists on SitterProfile (String?).
 *
 * Matching: by SitterProfile.displayName (case-insensitive trim) + city.
 *           If multiple candidates match (e.g. two "Alexis Clarens"), the
 *           script prints both and skips them — caller must disambiguate.
 *
 * Idempotency: re-runnable. If the address already matches what we want
 *              to set, the row is skipped with a "✓ already set" log.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/brain/import-sitter-addresses.ts
 *
 * Dry-run (default OFF — pass --dry to preview without writing):
 *   npx tsx --env-file=.env.local scripts/brain/import-sitter-addresses.ts --dry
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry");

// Source of truth for this one-shot import.
// Format: { name, city, address }
// `name` is matched against SitterProfile.displayName (case-insensitive)
// `city` disambiguates when two sitters share a first name.
const ADDRESSES: { name: string; city: string; address: string }[] = [
  { name: "Magali", city: "Vevey", address: "Rue du Lac 35, 1800 Vevey" },
  { name: "Matilda", city: "Lutry", address: "Chemin d'Orzens 40, 1095 Lutry" },
  { name: "Alexis Epremian", city: "Clarens", address: "Rue du Lac 128, 1815 Clarens" },
  { name: "Sydney", city: "Penthaz", address: "Chemin de la Vaux 21B, 1303 Penthaz" },
  { name: "Marie-Alexine", city: "Vevey", address: "Rue d'Italie 20, 1800 Vevey" },
  { name: "Nicole", city: "Ecublens", address: "Chemin du Stand 18, 1024 Ecublens" },
  { name: "Lucie", city: "Lausanne", address: "Chemin d'Entre Bois 55, 1018 Lausanne" },
  { name: "Coline", city: "Territet", address: "Rue du Bocherex 2, 1820 Territet" },
  { name: "Emmanuel", city: "Crissier", address: "Rue des Haies-Vives 3, 1023 Crissier" },
  { name: "Céline", city: "Chexbres", address: "Chemin du Signal 8, 1071 Chexbres" },
  { name: "Imma", city: "Lutry", address: "Chemin des Champs 6, 1095 Lutry" },
];

function normalise(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .trim();
}

async function main() {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Bulk update ${ADDRESSES.length} sitter addresses\n`);

  // Pull all activated sitters once so we can match locally.
  const candidates = (await prisma.sitterProfile.findMany({
    where: { lifecycleStatus: "activated" as any },
    select: {
      id: true,
      city: true,
      address: true,
      displayName: true,
      user: { select: { name: true, email: true } },
    },
  })) as Array<{
    id: string;
    city: string | null;
    address: string | null;
    displayName: string | null;
    user: { name: string | null; email: string };
  }>;

  let updated = 0;
  let already = 0;
  let skipped = 0;
  let ambiguous = 0;

  for (const target of ADDRESSES) {
    const nameNorm = normalise(target.name);
    const cityNorm = normalise(target.city);

    // 2-pass matching: first try strict (name + city), fall back to
    // name-only when city is empty in DB (some sitters were activated
    // before the city field was systematically collected — their real
    // city is in the address we're now back-filling).
    let matches = candidates.filter((c) => {
      const dispNorm = normalise(c.displayName ?? c.user.name);
      const cNorm = normalise(c.city);
      const nameOk = dispNorm.startsWith(nameNorm) || dispNorm.includes(nameNorm);
      const cityOk = cNorm === cityNorm;
      return nameOk && cityOk;
    });

    if (matches.length === 0) {
      // Fall back: name match where city is empty in DB
      matches = candidates.filter((c) => {
        const dispNorm = normalise(c.displayName ?? c.user.name);
        const cNorm = normalise(c.city);
        const nameOk = dispNorm.includes(nameNorm);
        return nameOk && cNorm === "";
      });
      if (matches.length === 1) {
        console.log(
          `  (match fallback: nom seul + city DB vide pour "${target.name}")`,
        );
      }
    }

    if (matches.length === 0) {
      console.log(`✗ Aucun match pour "${target.name}" / ${target.city} — SKIP`);
      skipped++;
      continue;
    }

    if (matches.length > 1) {
      console.log(
        `⚠️  Ambigu pour "${target.name}" / ${target.city} — ${matches.length} candidats :`,
      );
      for (const m of matches) {
        console.log(`     · ${m.displayName ?? m.user.name} (${m.user.email}) id=${m.id}`);
      }
      console.log("     → SKIP (désambiguïse à la main si nécessaire)");
      ambiguous++;
      continue;
    }

    const sp = matches[0]!;
    const currentAddr = (sp.address ?? "").trim();
    if (currentAddr && currentAddr.toLowerCase() === target.address.toLowerCase()) {
      console.log(`✓ Déjà à jour : ${sp.displayName ?? sp.user.name} → "${currentAddr}"`);
      already++;
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `→ ${sp.displayName ?? sp.user.name} : "${currentAddr || "(vide)"}" → "${target.address}"`,
      );
    } else {
      await prisma.sitterProfile.update({
        where: { id: sp.id },
        data: { address: target.address },
      });
      console.log(`✓ Mis à jour : ${sp.displayName ?? sp.user.name} → "${target.address}"`);
    }
    updated++;
  }

  console.log("\n──────────────────────────────────────────");
  console.log(
    `${DRY_RUN ? "[DRY] " : ""}Résumé : ${updated} ${DRY_RUN ? "à mettre à jour" : "mis à jour"}, ${already} déjà OK, ${ambiguous} ambigus, ${skipped} sans match`,
  );
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
