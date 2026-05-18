#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Export all DogShift sitters into the brain vault as individual Markdown
 * fiches, plus a synthesis index, inside brain/👥 Pilote/Tous les sitters actifs/.
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
 *  - Writes:
 *      • brain/👥 Pilote/Tous les sitters actifs/_Index.md — overview table
 *      • brain/👥 Pilote/Tous les sitters actifs/<Sitter Name>.md — one fiche
 *        per sitter with full coordinates
 *  - Always lands in brain/ which is gitignored, so no PII ever reaches Git.
 *
 * Idempotency strategy for per-sitter fiches:
 *  - The index file is always fully overwritten.
 *  - Each per-sitter fiche has frontmatter `auto_synced: true`. If present,
 *    the script overwrites the file (re-syncing from DB). If absent (custom
 *    fiche), the script SKIPS the file to preserve manual notes / onboarding
 *    checklists / interactions log (e.g. Sonia Morges, Sysy Montreux).
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/brain/export-sitters.ts
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

/**
 * Disambiguate sitters that share a label (e.g. two "Alexis Clarens") by
 * suffixing the activation date. Mutates labels in place.
 */
function uniquifyLabels(sitters: ActiveSitter[], labels: string[]): string[] {
  const counts = new Map<string, number>();
  for (const l of labels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const out = [...labels];
  for (let i = 0; i < out.length; i++) {
    const l = out[i];
    if ((counts.get(l) ?? 0) > 1) {
      const datePart = formatDate(sitters[i].activatedAt);
      out[i] = `${l} (${datePart})`;
    }
  }
  return out;
}

/**
 * Replace OS-unfriendly chars in a label for safe use as a filename.
 * Obsidian wikilinks are agnostic to the file path on disk as long as the
 * displayed label matches the basename.
 */
function safeFilename(label: string): string {
  return label.replace(/[\/\\:]/g, "-");
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

  const today = new Date().toISOString().slice(0, 10);
  const rawLabels = sitters.map((s) => wikilinkLabel(s));
  const labels = uniquifyLabels(sitters, rawLabels);

  const folderPath = join(process.cwd(), "brain", "👥 Pilote", "Tous les sitters actifs");
  mkdirSync(folderPath, { recursive: true });

  // ── 1) Build the index ───────────────────────────────────────────────
  const indexLines: string[] = [];
  indexLines.push("# 👥 Tous les sitters actifs", "");
  indexLines.push(`> Vue synthétique générée depuis la prod DB le **${today}**.`);
  indexLines.push(
    "> Source de vérité = Neon. Chaque sitter a sa fiche individuelle dans ce dossier — clique sur `[[Prénom Ville]]` pour ouvrir. Pour resynchroniser : `npx tsx --env-file=.env.local scripts/brain/export-sitters.ts`.",
    "",
  );
  indexLines.push(`Total : **${sitters.length}** sitters avec lifecycle \`activated\`.`, "");

  indexLines.push("## Vue d'ensemble", "");
  indexLines.push(
    "| Sitter | Adresse | Services | Tarifs | Activé | Dispos | Bookings | Stripe | Profil |",
  );
  indexLines.push("|---|---|---|---|---|---|---|---|---|");
  for (let i = 0; i < sitters.length; i++) {
    const s = sitters[i];
    const label = labels[i];
    const services = formatServices(s.services);
    const pricing = formatPricing(s.pricing);
    const activated = formatDate(s.activatedAt);
    const availCount = s.user._count.availabilityRules;
    const availIcon = availCount > 0 ? `✅ ${availCount}` : "⚠️ 0";
    const bookings = s._bookingsCount ?? 0;
    const stripe = s.stripeAccountStatus ?? "—";
    const published = s.published ? "🟢" : "⚪";
    const addrOrCity = s.address || s.city || "—";
    indexLines.push(
      `| [[${label}]] | ${addrOrCity} | ${services} | ${pricing} | ${activated} | ${availIcon} | ${bookings} | ${stripe} | ${published} |`,
    );
  }
  indexLines.push("");
  indexLines.push("## Liens", "");
  indexLines.push("- [[DogShift Brain]]");
  indexLines.push("- Sources de vérité techniques : [[data-models]], [[AUTH]]");
  indexLines.push("");

  // The index lives alongside the folder, not inside — it's the "parent note"
  // for the folder, following Obsidian's folder-note convention. Clicking on
  // it gives the overview; expanding the folder gives the individual fiches.
  const indexPath = join(process.cwd(), "brain", "👥 Pilote", "Tous les sitters actifs.md");
  writeFileSync(indexPath, indexLines.join("\n"), "utf8");
  console.log(`✓ Index écrit : ${indexPath}`);

  // ── 2) Per-sitter fiches ─────────────────────────────────────────────
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < sitters.length; i++) {
    const s = sitters[i];
    const label = labels[i];
    const filePath = join(folderPath, `${safeFilename(label)}.md`);

    // Honor manual edits: only overwrite files marked `auto_synced: true`.
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, "utf8");
      if (!/^auto_synced:\s*true/m.test(existing)) {
        skipped++;
        continue;
      }
    }

    const lines: string[] = [];
    lines.push("---");
    lines.push("auto_synced: true");
    lines.push(`synced_at: ${today}`);
    lines.push(`sitter_id: ${s.sitterId}`);
    lines.push("---");
    lines.push("");
    lines.push(`# ${label}`, "");
    lines.push("> Fiche générée depuis la prod DB. Pour la garder, supprime la ligne `auto_synced: true` du frontmatter et ajoute tes notes en dessous.", "");

    lines.push("## Coordonnées", "");
    lines.push("- **Email** : " + (s.user.email || "—"));
    lines.push("- **Téléphone** : " + (s.user.phone || "—"));
    lines.push("- **Adresse** : " + (s.address || "—"));
    lines.push("- **Ville** : " + (s.city || "—") + (s.postalCode ? ` (${s.postalCode})` : ""));
    lines.push("- **Sitter ID** : `" + s.sitterId + "`");
    lines.push("");

    lines.push("## Onboarding", "");
    lines.push("- **Activée le** : " + formatDate(s.activatedAt));
    lines.push("- **Contrat signé le** : " + formatDate(s.contractSignedAt));
    lines.push("- **Lifecycle** : `" + s.lifecycleStatus + "`");
    lines.push("- **Profil publié** : " + (s.published ? "🟢 oui" : "⚪ non"));
    lines.push("- **Stripe Connect** : " + (s.stripeAccountStatus || "—"));
    lines.push("");

    lines.push("## Profil", "");
    lines.push("- **Services** : " + formatServices(s.services));
    lines.push("- **Tarifs** : " + formatPricing(s.pricing));
    lines.push("- **Capacité (places)** : " + s.capacityPlaces);
    lines.push("- **Disponibilités configurées** : " + s.user._count.availabilityRules + " règles");
    lines.push("- **Bookings reçus (total)** : " + (s._bookingsCount ?? 0));
    lines.push("");

    lines.push("## Notes / Interactions", "");
    lines.push("- *(Aucune note manuelle. Supprime `auto_synced: true` du frontmatter pour préserver tes ajouts au prochain sync.)*", "");

    lines.push("## Liens", "");
    lines.push("- [[Tous les sitters actifs]]");
    lines.push("- [[DogShift Brain]]");
    lines.push("");

    const isNew = !existsSync(filePath);
    writeFileSync(filePath, lines.join("\n"), "utf8");
    if (isNew) created++;
    else updated++;
  }

  console.log(`✓ Fiches : ${created} créées, ${updated} resynchronisées, ${skipped} préservées (custom).`);
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
