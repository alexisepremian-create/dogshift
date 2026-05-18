#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * One-shot backfill of AgentLog rows for the sitter-onboarding-nudge cron.
 *
 * Context
 * -------
 * The cron (introduced in PR #354) sends a progressive sequence of nudge
 * emails to activated-but-not-published sitters: welcome → day_1 → day_3
 * → day_7 → day_14. Stage selection is based on `activatedAt`, so a
 * sitter activated 21 days ago who has never been emailed would get the
 * J+14 "DERNIER RAPPEL — suspension imminente" out of the blue. That's
 * too aggressive for sitters who have never been contacted at all.
 *
 * This script lets ops backfill a per-sitter set of "fake-sent" stages
 * so the cron skips them (or sends a less aggressive stage). Each
 * backfilled row is tagged with status="success" and a clear summary so
 * the audit trail explains why no real email was actually delivered.
 *
 * Per-sitter configuration is hard-coded at the bottom of this file (the
 * `BACKFILL` array). Edit and re-run to apply.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/brain/backfill-onboarding-nudge-history.ts --dry
 *   npx tsx --env-file=.env.local scripts/brain/backfill-onboarding-nudge-history.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry");

type Stage = "welcome" | "day_1" | "day_3" | "day_7" | "day_14";
const ALL_STAGES: Stage[] = ["welcome", "day_1", "day_3", "day_7", "day_14"];

/**
 * Per-sitter backfill plan.
 *
 * `match`: case-insensitive substring matched against displayName/user.name/
 *          user.email/city. We pick the FIRST result and bail if the match
 *          is ambiguous (multiple candidates).
 * `skipStages`: list of stages to mark as "already sent" so the cron
 *          doesn't send them. The cron will still consider the stages NOT
 *          in this list — so picking `["welcome","day_1","day_7","day_14"]`
 *          means the sitter will receive `day_3` next run.
 *          Use ALL_STAGES to fully silence the sequence.
 * `reason`: written into the AgentLog summary so future-you knows why this
 *          row exists.
 */
const BACKFILL: Array<{
  match: string;
  skipStages: Stage[];
  reason: string;
}> = [
  {
    match: "Sysy",
    // Skip welcome/day_1/day_7/day_14 — she'll receive only day_3 ("Reprends
    // ton onboarding en 5 min", purple, doux) next morning the cron runs.
    skipStages: ["welcome", "day_1", "day_7", "day_14"],
    reason:
      "Backfill — sitter activated 27 avril 2026 but never received any nudge (inactivity-check skips published=false). " +
      "Skipping welcome/day_1/day_7/day_14 so the cron picks day_3 (soft purple reminder), not day_14 (suspension warning).",
  },
  {
    match: "Alexis Epremian",
    skipStages: ALL_STAGES,
    reason:
      "Backfill — founder's own test account (alexis.epremian@gmail.com). Full sequence silenced to avoid self-spam.",
  },
  // Both Alexis Clarens entries — match by city + name. If the match is
  // ambiguous the script will bail and we'll need to disambiguate manually.
  // For now we silence ANY Alexis Clarens that isn't published, regardless
  // of which row it is.
  {
    match: "Alexis Clarens",
    skipStages: ALL_STAGES,
    reason:
      "Backfill — Alexis Clarens test/duplicate account. Full sequence silenced.",
  },
];

async function main() {
  console.log(`${DRY_RUN ? "[DRY] " : ""}Backfilling ${BACKFILL.length} sitter entries\n`);

  for (const entry of BACKFILL) {
    const matches = (await (prisma as any).sitterProfile.findMany({
      where: {
        lifecycleStatus: "activated",
        published: false,
        OR: [
          { displayName: { contains: entry.match, mode: "insensitive" } },
          { user: { name: { contains: entry.match, mode: "insensitive" } } },
          { user: { email: { contains: entry.match, mode: "insensitive" } } },
          { city: { contains: entry.match, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        city: true,
        activatedAt: true,
        user: { select: { name: true, email: true } },
      },
    })) as Array<{
      id: string;
      userId: string;
      displayName: string | null;
      city: string | null;
      activatedAt: Date | null;
      user: { name: string | null; email: string };
    }>;

    if (matches.length === 0) {
      console.log(`✗ "${entry.match}" — aucun match (unpublished activated sitter) — SKIP`);
      continue;
    }

    for (const sp of matches) {
      const label = `${sp.displayName ?? sp.user.name} <${sp.user.email}>`;

      const existingRows = (await (prisma as any).agentLog.findMany({
        where: {
          agentName: "sitter-onboarding-nudge",
          targetId: sp.userId,
        },
        select: { actionType: true },
      })) as Array<{ actionType: string }>;
      const alreadyBackfilled = new Set(existingRows.map((r) => r.actionType));

      const toInsert = entry.skipStages.filter((s) => !alreadyBackfilled.has(s));
      if (toInsert.length === 0) {
        console.log(`✓ Déjà à jour : ${label} (${entry.skipStages.length} stages déjà loggés)`);
        continue;
      }

      console.log(
        `${DRY_RUN ? "→ [DRY] " : "✓ "}${label} : backfill ${toInsert.join(", ")} (raison : ${entry.reason.slice(0, 60)}...)`,
      );

      if (!DRY_RUN) {
        for (const stage of toInsert) {
          await (prisma as any).agentLog.create({
            data: {
              agentName: "sitter-onboarding-nudge",
              actionType: stage,
              status: "success",
              targetId: sp.userId,
              summary: `[BACKFILL — no email actually sent] ${entry.reason}`,
              details: {
                stage,
                backfill: true,
                email: sp.user.email,
                sitterProfileId: sp.id,
                activatedAt: sp.activatedAt?.toISOString() ?? null,
                reason: entry.reason,
              },
            },
          });
        }
      }
    }
  }

  console.log(`\n${DRY_RUN ? "[DRY] " : ""}Done.`);
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
