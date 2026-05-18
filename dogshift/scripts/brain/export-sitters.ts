#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export all DogShift sitters into a single Markdown note inside
 * brain/👥 Pilote/_Tous les sitters actifs.md.
 *
 * Why this exists:
 *  - The brain/ vault is the founder's source of truth for human-readable
 *    sitter context (interactions, onboarding state, notes).
 *  - The DB (Neon) is the source of truth for the actual sitter records
 *    (email, phone, lifecycle, Stripe Connect status, …).
 *  - Manually copying from one to the other is tedious and goes stale fast.
 *
 * What it does:
 *  - Queries every SitterProfile with lifecycleStatus === "activated"
 *  - Pulls the linked User (name, email, phone) and counts availability
 *    rules + bookings as light "is this sitter actually live" indicators
 *  - Writes a single Markdown note with:
 *      • a one-row-per-sitter overview table at the top (sorted by activation date)
 *      • a per-sitter section below with full details + wikilink to the
 *        individual fiche if it exists (e.g. [[Sonia Morges]])
 *  - Always lands in brain/ which is gitignored, so no PII ever reaches Git.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/brain/export-sitters.ts
 *
 * Reruns are idempotent — the file is fully overwritten each time.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ActiveSitter = {
  id: string;
  userId: string;
  sitterId: string;
  displayName: string | null;
  city: string | null;
  postalCode: string | null;
  address: string | null;
  published: boolean;
  lifecycleStatus: string;
  activatedAt: Date | null;
  contractSignedAt: Date | null;
  stripeAccountStatus: string | null;
  services: any;
  pricing: any;
  dogSizes: any;
  capacityPlaces: number;
  user: {
    name: string | null;
    email: string;
    phone: string | null;
    _count: { availabilityRules: number };
  };
  _bookingsCount?: number;
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

function formatServices(services: any): string {
  if (!services) return "—";
  if (Array.isArray(services)) return services.join(", ");
  if (typeof services === "object") {
    const enabled = Object.entries(services)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k);
    return enabled.length ? enabled.join(", ") : "—";
  }
  return String(services);
}

function formatPricing(pricing: any): string {
  if (!pricing || typeof pricing !== "object") return "—";
  const parts: string[] = [];
  if (typeof pricing.walkRate === "number") parts.push(`Promenade ${pricing.walkRate} CHF/h`);
  if (typeof pricing.sittingRate === "number") parts.push(`Garde ${pricing.sittingRate} CHF/h`);
  if (typeof pricing.pricePerDay === "number") parts.push(`Pension ${pricing.pricePerDay} CHF/j`);
  return parts.length ? parts.join(" · ") : "—";
}

/**
 * Convert "Sonia Morges" → "Sonia Morges" (a valid Obsidian wikilink anchor).
 * We don't slugify because Obsidian wikilinks support spaces and accents.
 * The displayName in DB may include a city already; we strip "Morges" if it
 * looks duplicated.
 */
function wikilinkLabel(s: ActiveSitter): string {
  const name = (s.displayName ?? s.user.name ?? "").trim();
  const city = (s.city ?? "").trim();
  if (!name) return s.sitterId; // fallback: sitterId is always set
  if (city && !name.toLowerCase().includes(city.toLowerCase())) {
    return `${name} ${city}`;
  }
  return name;
}

async function main() {
  console.log("Querying activated sitters …");

  const sitters = (await prisma.sitterProfile.findMany({
    where: { lifecycleStatus: "activated" as any },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          _count: { select: { availabilityRules: true } },
        },
      },
    },
    orderBy: { activatedAt: "desc" },
  })) as unknown as ActiveSitter[];

  // Best-effort: per-sitter bookings count (uses Booking.sitterId === User.sitterId)
  for (const s of sitters) {
    if (s.sitterId) {
      s._bookingsCount = await prisma.booking.count({
        where: { sitterId: s.sitterId },
      });
    } else {
      s._bookingsCount = 0;
    }
  }

  console.log(`  ${sitters.length} sitters trouvés`);

  // ── Build the Markdown ────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push("# 👥 Tous les sitters actifs", "");
  lines.push(`> Vue synthétique générée depuis la prod DB le **${today}**.`);
  lines.push(
    "> Source de vérité = Neon. Pour éditer une fiche individuelle, ouvre la note `[[<Prénom Ville>]]` en bas. Pour resynchroniser : `npx tsx --env-file=.env.local scripts/brain/export-sitters.ts`.",
    "",
  );
  lines.push(`Total : **${sitters.length}** sitters avec lifecycle \`activated\`.`, "");

  // Overview table
  lines.push("## Vue d'ensemble", "");
  lines.push(
    "| Sitter | Adresse | Services | Tarifs | Activé | Dispos | Bookings | Stripe | Profil |",
  );
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const s of sitters) {
    const label = wikilinkLabel(s);
    const services = formatServices(s.services);
    const pricing = formatPricing(s.pricing);
    const activated = formatDate(s.activatedAt);
    const availCount = s.user._count.availabilityRules;
    const availIcon = availCount > 0 ? `✅ ${availCount}` : "⚠️ 0";
    const bookings = s._bookingsCount ?? 0;
    const stripe = s.stripeAccountStatus ?? "—";
    const published = s.published ? "🟢" : "⚪";
    const addrOrCity = s.address || s.city || "—";
    lines.push(
      `| [[${label}]] | ${addrOrCity} | ${services} | ${pricing} | ${activated} | ${availIcon} | ${bookings} | ${stripe} | ${published} |`,
    );
  }
  lines.push("");

  // Per-sitter detail blocks
  lines.push("## Détails par sitter", "");
  for (const s of sitters) {
    const label = wikilinkLabel(s);
    lines.push(`### [[${label}]]`, "");
    lines.push("- **Email** : " + (s.user.email || "—"));
    lines.push("- **Téléphone** : " + (s.user.phone || "—"));
    lines.push("- **Adresse** : " + (s.address || "—"));
    lines.push("- **Ville** : " + (s.city || "—") + (s.postalCode ? ` (${s.postalCode})` : ""));
    lines.push("- **Sitter ID** : `" + s.sitterId + "`");
    lines.push("- **Activée le** : " + formatDate(s.activatedAt));
    lines.push("- **Contrat signé le** : " + formatDate(s.contractSignedAt));
    lines.push("- **Lifecycle** : `" + s.lifecycleStatus + "`");
    lines.push("- **Profil publié** : " + (s.published ? "🟢 oui" : "⚪ non"));
    lines.push("- **Services** : " + formatServices(s.services));
    lines.push("- **Tarifs** : " + formatPricing(s.pricing));
    lines.push("- **Capacité (places)** : " + s.capacityPlaces);
    lines.push("- **Disponibilités configurées** : " + s.user._count.availabilityRules + " règles");
    lines.push("- **Bookings reçus (total)** : " + (s._bookingsCount ?? 0));
    lines.push("- **Stripe Connect** : " + (s.stripeAccountStatus || "—"));
    lines.push("");
  }

  // Backlink to Home — zero-orphan policy
  lines.push("## Liens", "");
  lines.push("- [[🏠 Home]]");
  lines.push("- Sources de vérité techniques : [[data-models]], [[AUTH]]");
  lines.push("");

  // ── Write ─────────────────────────────────────────────────────────────
  const outPath = join(
    process.cwd(),
    "brain",
    "👥 Pilote",
    "Tous les sitters actifs.md",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(`✓ Écrit : ${outPath}`);
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
