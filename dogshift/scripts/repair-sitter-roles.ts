/**
 * Aligne `User.role` sur la réalité du profil sitter.
 *
 * Contexte : docs/bugs/sitter-role-not-promoted-on-activation.md. L'activation
 * (`POST /api/host/activation-code`) basculait `SitterProfile.lifecycleStatus`
 * à `activated` sans jamais toucher `User.role` — seul `/api/become-sitter/apply`
 * écrivait `role: "SITTER"`. Résultat : des sitters publiés restés `OWNER`.
 *
 * Le script est VOLONTAIREMENT étroit :
 *
 *   - il ne promeut que `OWNER → SITTER` (jamais un ADMIN, jamais une
 *     rétrogradation SITTER → OWNER) ;
 *   - il ne touche qu'aux users que `hasSitterSide()` reconnaît déjà comme
 *     sitters (profil publié / activé), donc rien de spéculatif ;
 *   - il exige un `sitterId` non nul, parce que c'est la clé métier sur laquelle
 *     pendent disponibilités et réservations.
 *
 * Usage :
 *   npx tsx --env-file=.env.local scripts/repair-sitter-roles.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/repair-sitter-roles.ts --apply  # écrit
 */

import { PrismaClient } from "@prisma/client";

import { hasSitterSide } from "@/lib/sitter/sitterRole";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

async function main() {
  const users = await prisma.user.findMany({
    where: { role: "OWNER", sitterProfile: { isNot: null } },
    select: {
      id: true,
      email: true,
      role: true,
      sitterId: true,
      sitterProfile: {
        select: { published: true, activatedAt: true, lifecycleStatus: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const toPromote = users.filter((u) => hasSitterSide(u) && !!u.sitterId);
  const skipped = users.filter((u) => hasSitterSide(u) && !u.sitterId);

  console.log(`\n${APPLY ? "APPLY" : "DRY-RUN"} — ${users.length} OWNER avec un SitterProfile\n`);

  if (toPromote.length === 0) {
    console.log("✅ Aucun rôle à corriger.");
  }

  for (const u of toPromote) {
    const p = u.sitterProfile;
    console.log(
      `  → ${u.email ?? u.id}  [${p?.lifecycleStatus ?? "—"}${p?.published ? " · publié" : ""}]  OWNER → SITTER`,
    );
  }

  for (const u of skipped) {
    console.log(`  ⚠️  ${u.email ?? u.id} — profil sitter actif mais sitterId nul, ignoré (à investiguer)`);
  }

  if (!APPLY) {
    console.log(`\n${toPromote.length} promotion(s) à appliquer. Relance avec --apply pour écrire.\n`);
    return;
  }

  let promoted = 0;
  for (const u of toPromote) {
    const { count } = await prisma.user.updateMany({
      where: { id: u.id, role: "OWNER" },
      data: { role: "SITTER" },
    });
    promoted += count;
  }
  console.log(`\n✅ ${promoted} rôle(s) promu(s).\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
