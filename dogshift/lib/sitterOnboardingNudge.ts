/**
 * Logic for choosing & sending the right sitter onboarding nudge email.
 *
 * Used in two places:
 *   - app/api/host/activation-code/route.ts — fires the "welcome" stage
 *     immediately after the sitter redeems their DS-XXXX-XXXX code
 *   - app/api/cron/sitter-onboarding-nudge/route.ts — daily cron that finds
 *     activated sitters still below 100% completion and sends the next stage
 *
 * Idempotency: each send writes an AgentLog row tagged `sitter-onboarding-nudge`
 * with the stage in metadata. The cron checks for an existing row before
 * sending the same stage twice.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderSitterOnboardingGuideEmail } from "@/lib/email/templates/sitterOnboardingGuideEmail";
import { computeSitterProfileCompletion } from "@/lib/sitterCompletion";
import { pickNudgeStage, type OnboardingNudgeStage } from "@/lib/sitterOnboardingNudgeSchedule";

// Re-export so existing call sites that imported these from here keep working.
export { pickNudgeStage, type OnboardingNudgeStage };

const DEFAULT_BASE_URL = "https://www.dogshift.ch";

export type NudgeSendResult =
  | { ok: true; stage: OnboardingNudgeStage; messageId: string | null }
  | { ok: false; reason: string };

/**
 * Send the onboarding nudge email + log it to AgentLog for idempotency.
 *
 * Caller is responsible for fetching the sitter's profile snapshot and
 * checking that completion < 100 (we don't want to nudge published sitters).
 */
export async function sendSitterOnboardingNudge(args: {
  stage: OnboardingNudgeStage;
  sitterUserId: string;
  email: string;
  firstName: string;
  profile: unknown;
  baseUrl?: string;
}): Promise<NudgeSendResult> {
  const baseUrl = (args.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  const completion = computeSitterProfileCompletion(args.profile);
  if (completion >= 100) {
    return { ok: false, reason: "profile_already_complete" };
  }

  const { subject, text, html } = renderSitterOnboardingGuideEmail({
    firstName: args.firstName,
    profile: args.profile,
    stage: args.stage,
    baseUrl,
  });

  try {
    const result = await sendEmail(
      {
        to: args.email,
        subject,
        text,
        html,
      },
      {
        templateName: `sitter-onboarding-nudge-${args.stage.replace(/_/g, "-")}`,
        context: "lib:sitterOnboardingNudge",
        targetUserId: args.sitterUserId,
        metadata: { stage: args.stage, completionPercent: completion },
      },
    );

    // Log the send so the cron doesn't repeat the same stage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentLog details is Json.
    await (prisma as any).agentLog.create({
      data: {
        agentName: "sitter-onboarding-nudge",
        actionType: args.stage,
        summary: `Sent ${args.stage} nudge to ${args.email} (completion ${completion}%)`,
        targetId: args.sitterUserId,
        status: "success",
        details: {
          stage: args.stage,
          email: args.email,
          completionPercent: completion,
          messageId: result.messageId ?? null,
        },
      },
    });

    return { ok: true, stage: args.stage, messageId: result.messageId ?? null };
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentLog details is Json.
    await (prisma as any).agentLog
      .create({
        data: {
          agentName: "sitter-onboarding-nudge",
          actionType: args.stage,
          summary: `FAILED ${args.stage} nudge to ${args.email}: ${err instanceof Error ? err.message : String(err)}`,
          targetId: args.sitterUserId,
          status: "error",
          details: {
            stage: args.stage,
            email: args.email,
            error: err instanceof Error ? err.message : String(err),
          },
        },
      })
      .catch(() => {
        /* swallow — logging is best-effort */
      });
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Fetch the stages already sent for a given sitter (by userId).
 * Used by the cron to decide which stage is next.
 */
export async function getAlreadySentStages(sitterUserId: string): Promise<OnboardingNudgeStage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AgentLog has no generated type for actionType filter.
  const rows = (await (prisma as any).agentLog.findMany({
    where: {
      agentName: "sitter-onboarding-nudge",
      targetId: sitterUserId,
      status: "success",
    },
    select: { actionType: true },
  })) as Array<{ actionType: string }>;

  const VALID: OnboardingNudgeStage[] = ["welcome", "day_1", "day_3", "day_7", "day_14"];
  return rows
    .map((r) => r.actionType as OnboardingNudgeStage)
    .filter((s): s is OnboardingNudgeStage => VALID.includes(s));
}
