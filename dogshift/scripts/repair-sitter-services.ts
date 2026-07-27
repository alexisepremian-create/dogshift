/**
 * Répare l'incohérence « service annoncé mais injouable » sur les sitters publiés.
 *
 * Contexte : docs/bugs/service-availability-desync.md. Avant le fix, un sitter
 * pouvait avoir un service annoncé publiquement sans tarif et/ou sans la moindre
 * disponibilité — la fiche l'affichait, chaque date répondait UNAVAILABLE. Et
 * `syncSitterServices()` ne pouvait jamais soigner ces profils (la branche
 * `create` de l'upsert throwait sur les colonnes Int obligatoires).
 *
 * Le script est VOLONTAIREMENT conservateur :
 *
 *   - il part de l'état PUBLIC actuel (`resolvePublicEnabledServices`), donc de
 *     ce que les propriétaires voient réellement aujourd'hui ;
 *   - il en RETIRE uniquement les services injouables (pas de tarif > 0, ou
 *     aucune disponibilité) ;
 *   - il n'ajoute jamais un service, et ignore les sitters non publiés (ils se
 *     resynchroniseront tout seuls au prochain enregistrement, la cause racine
 *     étant corrigée).
 *
 * Usage :
 *   npx tsx --env-file=.env.local scripts/repair-sitter-services.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/repair-sitter-services.ts --apply  # écrit
 */

import { PrismaClient } from "@prisma/client";

import { SERVICE_DEFAULTS } from "@/lib/availability/slotEngine";
import { syncSitterServices } from "@/lib/sitter/serviceSync";
import { resolvePublicEnabledServices, type PublicServiceLabel } from "@/lib/sitterEnabledServices";

const prisma = new PrismaClient();

const SERVICE_TYPES = ["PROMENADE", "DOGSITTING", "PENSION"] as const;
type ServiceTypeEnum = (typeof SERVICE_TYPES)[number];

const UI_LABEL: Record<ServiceTypeEnum, PublicServiceLabel> = {
  PROMENADE: "Promenade",
  DOGSITTING: "Garde",
  PENSION: "Pension",
};

const APPLY = process.argv.includes("--apply");

function hasPrice(pricing: unknown, label: PublicServiceLabel): boolean {
  if (!pricing || typeof pricing !== "object") return false;
  const v = (pricing as Record<string, unknown>)[label];
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

async function main() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: { sitterId: { not: null }, sitterProfile: { published: true } },
    select: {
      id: true,
      email: true,
      sitterId: true,
      sitterProfile: { select: { displayName: true, pricing: true, services: true } },
    },
  });

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const db = prisma as any;
  const sitterIds = users.map((u) => u.sitterId!).filter(Boolean);

  const [configs, ruleGroups, exceptionGroups] = await Promise.all([
    db.serviceConfig.findMany({
      where: { sitterId: { in: sitterIds } },
      select: { sitterId: true, serviceType: true, enabled: true },
    }),
    db.availabilityRule.groupBy({
      by: ["sitterId", "serviceType"],
      where: { sitterId: { in: sitterIds }, status: { in: ["AVAILABLE", "ON_REQUEST"] } },
    }),
    db.availabilityException.groupBy({
      by: ["sitterId", "serviceType"],
      where: { sitterId: { in: sitterIds }, status: { in: ["AVAILABLE", "ON_REQUEST"] }, date: { gte: today } },
    }),
  ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const key = (sitterId: string, serviceType: string) => `${sitterId}::${serviceType}`;
  const rowsBySitter = new Map<string, { serviceType: string; enabled: boolean }[]>();
  for (const row of configs) {
    const list = rowsBySitter.get(row.sitterId) ?? [];
    list.push({ serviceType: row.serviceType, enabled: row.enabled === true });
    rowsBySitter.set(row.sitterId, list);
  }
  const bookable = new Set<string>();
  for (const row of [...ruleGroups, ...exceptionGroups]) bookable.add(key(row.sitterId, row.serviceType));

  let touched = 0;

  for (const user of users) {
    const sitterId = user.sitterId!;
    const label = user.sitterProfile?.displayName || user.email || sitterId;
    const rows = rowsBySitter.get(sitterId) ?? [];

    // Ce que les propriétaires voient AUJOURD'HUI. On ne retire que de là,
    // donc le script ne peut jamais publier un service en plus.
    const current = new Set(
      resolvePublicEnabledServices({
        serviceConfigs: rows,
        pricing: user.sitterProfile?.pricing,
        servicesJson: user.sitterProfile?.services,
      }),
    );

    const next: Record<ServiceTypeEnum, boolean> = { PROMENADE: false, DOGSITTING: false, PENSION: false };
    const reasons: string[] = [];

    for (const serviceType of SERVICE_TYPES) {
      const ui = UI_LABEL[serviceType];
      if (!current.has(ui)) continue;
      if (!hasPrice(user.sitterProfile?.pricing, ui)) {
        reasons.push(`${ui}: annoncé sans tarif → retiré`);
        continue;
      }
      if (!bookable.has(key(sitterId, serviceType))) {
        reasons.push(`${ui}: annoncé sans aucune disponibilité → retiré`);
        continue;
      }
      next[serviceType] = true;
    }

    if (reasons.length === 0) continue;
    touched++;

    console.log(`\n▸ ${label} (${sitterId})`);
    for (const reason of reasons) console.log(`   · ${reason}`);
    console.log(
      `   → services publics : [${[...current].join(", ") || "aucun"}] → [${
        SERVICE_TYPES.filter((s) => next[s]).map((s) => UI_LABEL[s]).join(", ") || "aucun"
      }]`,
    );

    if (!APPLY) continue;

    // Les 3 lignes doivent exister avant le sync — SERVICE_DEFAULTS remplit les
    // colonnes Int sans défaut Prisma (la cause racine du bug).
    const existing = new Set(rows.map((r) => r.serviceType));
    for (const serviceType of SERVICE_TYPES) {
      if (existing.has(serviceType)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).serviceConfig.create({
        data: { ...SERVICE_DEFAULTS[serviceType], sitterId, serviceType, enabled: next[serviceType] },
      });
    }

    await syncSitterServices(prisma, {
      sitterId,
      userId: user.id,
      services: { Promenade: next.PROMENADE, Garde: next.DOGSITTING, Pension: next.PENSION },
    });
    console.log("   ✔ appliqué");
  }

  console.log(
    `\n${APPLY ? "Appliqué" : "Dry-run"} — ${touched} sitter(s) publié(s) à corriger sur ${users.length}.` +
      (APPLY ? "" : " Relance avec --apply pour écrire."),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
