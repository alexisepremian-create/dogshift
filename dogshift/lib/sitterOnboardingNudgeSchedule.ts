/**
 * Pure scheduling logic for the sitter onboarding nudge cron.
 *
 * Split out from lib/sitterOnboardingNudge.ts so it can be unit-tested
 * without pulling in Prisma / Resend / `@/` path-alias resolution
 * (Node's --test runner can't resolve TypeScript path aliases).
 */

export type OnboardingNudgeStage = "welcome" | "day_1" | "day_3" | "day_7" | "day_14";

/**
 * Pick the next stage to send for a sitter given when they activated and
 * which stages were already sent.
 *
 * Returns null when:
 *   - they activated too recently for the next stage to be due
 *   - they've already received the full sequence
 *
 * Cascade strategy (intentional): when the cron has missed days (outage,
 * deploy delay, etc.), we always send the LATEST stage that's due, not the
 * earliest. Sending a "day 1" email to someone activated 10 days ago is
 * misleading — they'd think we're catching up. Sending "day 7" instead
 * matches the real elapsed time.
 *
 * Test that documents this behaviour lives in
 * tests/integrations/sitterOnboardingNudge.test.ts.
 */
export function pickNudgeStage(args: {
  activatedAt: Date;
  alreadySentStages: OnboardingNudgeStage[];
  now?: Date;
}): OnboardingNudgeStage | null {
  const now = args.now ?? new Date();
  const daysSinceActivation = Math.floor(
    (now.getTime() - args.activatedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const sent = new Set(args.alreadySentStages);

  // Stages from latest → earliest. First match wins.
  const schedule: { stage: OnboardingNudgeStage; dueAtDay: number }[] = [
    { stage: "day_14", dueAtDay: 14 },
    { stage: "day_7", dueAtDay: 7 },
    { stage: "day_3", dueAtDay: 3 },
    { stage: "day_1", dueAtDay: 1 },
  ];

  for (const { stage, dueAtDay } of schedule) {
    if (daysSinceActivation >= dueAtDay && !sent.has(stage)) return stage;
  }
  return null;
}
