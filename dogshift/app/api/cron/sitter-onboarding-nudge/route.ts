/**
 * GET /api/cron/sitter-onboarding-nudge
 *
 * Daily cron (Vercel) that finds activated sitters still below 100% profile
 * completion and sends them the next progressive nudge email in the sequence
 * (J+1, J+3, J+7, J+14 from activation).
 *
 * Sitters whose profile is already published (= 100% completion + Stripe
 * onboarded + manually toggled ON) are skipped. Sitters past J+14 are also
 * skipped — 5 nudges is the cap, more is spam.
 *
 * Auth: Bearer CRON_SECRET (Vercel cron) OR MAINTENANCE_API_KEY (ops manual
 * trigger), matching the pattern used by maintenance-recap.
 *
 * Idempotency: each successful send writes an AgentLog row tagged with the
 * stage, so re-runs of the cron during the same day don't double-nudge.
 *
 * Returns a per-sitter summary in the JSON response for monitoring.
 */
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  getAlreadySentStages,
  pickNudgeStage,
  sendSitterOnboardingNudge,
} from "@/lib/sitterOnboardingNudge";
import { computeSitterProfileCompletion } from "@/lib/sitterCompletion";
import { reportApiError } from "@/lib/observability/reportApiError";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import {
  escapeHtml,
  pluralFR,
  tgFooter,
  tgHeader,
  tgMessage,
  tgSection,
} from "@/lib/telegram/format";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronBearer = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const maintBearer = `Bearer ${(process.env.MAINTENANCE_API_KEY ?? "").trim()}`;
  const isAuthorized =
    (process.env.CRON_SECRET && authHeader === cronBearer) ||
    (process.env.MAINTENANCE_API_KEY && authHeader === maintBearer);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Pull all activated-but-not-fully-published sitters in one query.
    // We only nudge while lifecycleStatus === "activated" — sitters who later
    // get "suspended" are managed by the inactivity-check cron instead.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma client cast while generated types lag the pilot schema.
    const candidates = (await (prisma as any).sitterProfile.findMany({
      where: {
        lifecycleStatus: "activated",
        // Once published, the sitter has finished onboarding — stop nudging.
        published: false,
      },
      select: {
        id: true,
        userId: true,
        activatedAt: true,
        // All fields needed by computeSitterProfileCompletion
        avatarUrl: true,
        displayName: true,
        city: true,
        address: true,
        bio: true,
        services: true,
        pricing: true,
        acceptsSmall: true,
        acceptsMedium: true,
        acceptsLarge: true,
        stripeAccountStatus: true,
        user: { select: { email: true, name: true } },
      },
    })) as Array<{
      id: string;
      userId: string;
      activatedAt: Date | null;
      avatarUrl: string | null;
      displayName: string | null;
      city: string | null;
      address: string | null;
      bio: string | null;
      services: unknown;
      pricing: unknown;
      acceptsSmall: boolean | null;
      acceptsMedium: boolean | null;
      acceptsLarge: boolean | null;
      stripeAccountStatus: string | null;
      user: { email: string; name: string | null };
    }>;

    const results = {
      candidatesFound: candidates.length,
      sent: 0,
      skippedNoStageDue: 0,
      skippedAlreadyComplete: 0,
      skippedNoActivationDate: 0,
      errors: 0,
    };

    // Track per-sitter what was sent for the recap Telegram at the end.
    const sentDetails: Array<{ name: string; email: string; stage: string }> = [];

    for (const sp of candidates) {
      if (!sp.activatedAt) {
        results.skippedNoActivationDate++;
        continue;
      }

      const profileSnapshot = {
        avatarUrl: sp.avatarUrl,
        firstName: sp.displayName ?? sp.user.name,
        city: sp.city,
        address: sp.address,
        bio: sp.bio,
        services: sp.services,
        pricing: sp.pricing,
        acceptsSmall: sp.acceptsSmall ?? false,
        acceptsMedium: sp.acceptsMedium ?? false,
        acceptsLarge: sp.acceptsLarge ?? false,
        stripeAccountStatus: sp.stripeAccountStatus,
      };

      const completion = computeSitterProfileCompletion(profileSnapshot);
      if (completion >= 100) {
        results.skippedAlreadyComplete++;
        continue;
      }

      const alreadySent = await getAlreadySentStages(sp.userId);
      const stage = pickNudgeStage({
        activatedAt: sp.activatedAt,
        alreadySentStages: alreadySent,
      });
      if (!stage) {
        results.skippedNoStageDue++;
        continue;
      }

      const firstName = (sp.displayName ?? sp.user.name ?? "").trim() || "Dogsitter";
      const send = await sendSitterOnboardingNudge({
        stage,
        sitterUserId: sp.userId,
        email: sp.user.email,
        firstName,
        profile: profileSnapshot,
      });
      if (send.ok) {
        results.sent++;
        sentDetails.push({
          name: firstName,
          email: sp.user.email,
          stage,
        });
      } else {
        results.errors++;
      }
    }

    // Telegram recap to `relances` bot — only if anything actually happened,
    // otherwise the bot stays quiet. AWAITED (cron + fire-and-forget = dropped
    // by Vercel, see CLAUDE.md "Cron jobs" gotcha).
    let telegramSent = false;
    if (results.sent > 0 || results.errors > 0) {
      const stageEmoji: Record<string, string> = {
        welcome: "👋",
        day_1: "📅",
        day_3: "📅",
        day_7: "📅",
        day_14: "🚨",
      };
      const message = tgMessage([
        tgHeader("💌", "Onboarding sitters — nudges du jour"),
        [
          tgSection("📊", "Résumé"),
          `${pluralFR(results.candidatesFound, "candidat", "candidats")} examiné${results.candidatesFound !== 1 ? "s" : ""}`,
          `✅ ${pluralFR(results.sent, "nudge envoyé", "nudges envoyés")} · ⏭ ${pluralFR(results.skippedAlreadyComplete + results.skippedNoStageDue, "skip")}${results.errors > 0 ? ` · ⚠️ ${pluralFR(results.errors, "erreur")}` : ""}`,
        ],
        sentDetails.length > 0
          ? [
              tgSection("📤", "Détail"),
              ...sentDetails.map(
                (d) =>
                  `${stageEmoji[d.stage] ?? "📨"} <code>${escapeHtml(d.stage)}</code> → ${escapeHtml(d.name)} (${escapeHtml(d.email)})`,
              ),
            ]
          : null,
        tgFooter(),
      ]);
      telegramSent = await sendTelegramMessage(message, {
        bot: "relances",
        parseMode: "HTML",
      });
    }

    console.log("[cron][sitter-onboarding-nudge] done", { ...results, telegramSent });
    return NextResponse.json({ ok: true, telegramSent, ...results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron][sitter-onboarding-nudge] fatal", message);
    reportApiError({
      kind: "internal_error",
      code: "SITTER_ONBOARDING_NUDGE_FAILED",
      route: "cron.sitter-onboarding-nudge",
      extra: { message },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
