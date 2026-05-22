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
import { computeSitterProfileCompletionDetails } from "@/lib/sitterCompletion";
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

// Helpers used by the JSON-vs-column merge logic below.
function emptyOrMissing(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length === 0;
  return false;
}

function jsonHasDogSize(json: Record<string, unknown> | null, label: "Petit" | "Moyen" | "Grand"): boolean {
  if (!json) return false;
  const dogSizes = json.dogSizes;
  if (Array.isArray(dogSizes)) {
    return dogSizes.some((s) => typeof s === "string" && s.trim() === label);
  }
  if (dogSizes && typeof dogSizes === "object") {
    return Boolean((dogSizes as Record<string, unknown>)[label]);
  }
  return false;
}

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
        user: {
          select: {
            email: true,
            name: true,
            // The dashboard-side source of truth for service pricing &
            // legacy dogSize toggles. Read so we can double-check the cron
            // never sends "tarifs non définis" while the JSON proves they
            // are. Audit 2026-05-22 — Sylvana case.
            hostProfileJson: true,
          },
        },
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
      user: { email: string; name: string | null; hostProfileJson: string | null };
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
    // Audit 2026-05-22: when the column-only completion < 100 % but the
    // merged-with-JSON completion = 100 %, the column was lagging behind
    // the dashboard. We skip the email AND flag it so we can investigate.
    const divergent: Array<{ name: string; email: string; columnPercent: number; mergedPercent: number }> = [];

    for (const sp of candidates) {
      if (!sp.activatedAt) {
        results.skippedNoActivationDate++;
        continue;
      }

      const columnSnapshot = {
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

      // Merge with the dashboard JSON blob. The dashboard saves rich data
      // there; the column may lag if the POST handler only wrote part of
      // the payload. Strategy: column values take precedence for fields
      // the column actually owns (address, stripeAccountStatus), JSON
      // wins for everything else (the dashboard is the source of truth
      // for services/pricing/dogSizes when the column is empty/missing).
      let jsonParsed: Record<string, unknown> | null = null;
      const rawJson = sp.user.hostProfileJson;
      if (typeof rawJson === "string" && rawJson.trim().length > 0) {
        try {
          const parsed = JSON.parse(rawJson) as unknown;
          if (parsed && typeof parsed === "object") {
            jsonParsed = parsed as Record<string, unknown>;
          }
        } catch {
          // Corrupted JSON — treat as no JSON. Telegram alert later if it
          // changed the decision.
        }
      }
      const mergedSnapshot = jsonParsed
        ? {
            ...columnSnapshot,
            // Soft fields where JSON should win when present (preserves
            // user-typed data that didn't make it to the column).
            firstName: columnSnapshot.firstName ?? (jsonParsed.firstName as string | null) ?? null,
            bio: columnSnapshot.bio ?? (jsonParsed.bio as string | null) ?? null,
            services: emptyOrMissing(columnSnapshot.services) ? jsonParsed.services : columnSnapshot.services,
            pricing: emptyOrMissing(columnSnapshot.pricing) ? jsonParsed.pricing : columnSnapshot.pricing,
            // Dog-size toggles: column wins if any of accepts* is true,
            // otherwise fallback to the JSON's dogSizes record.
            acceptsSmall: columnSnapshot.acceptsSmall || jsonHasDogSize(jsonParsed, "Petit"),
            acceptsMedium: columnSnapshot.acceptsMedium || jsonHasDogSize(jsonParsed, "Moyen"),
            acceptsLarge: columnSnapshot.acceptsLarge || jsonHasDogSize(jsonParsed, "Grand"),
            // Stripe + address — column wins (always written by the
            // canonical writers, never via the JSON blob).
          }
        : columnSnapshot;

      const columnResult = computeSitterProfileCompletionDetails(columnSnapshot);
      const mergedResult = computeSitterProfileCompletionDetails(mergedSnapshot);

      // GUARD-RAIL #1: if either source says 100 %, the sitter is done.
      // We trust the optimistic side because the cost of sending one
      // false-positive nudge to a real completed sitter is unacceptable
      // (audit case Sylvana). The pessimistic side is allowed to be
      // wrong; the optimistic side is not.
      if (columnResult.percent >= 100 || mergedResult.percent >= 100) {
        results.skippedAlreadyComplete++;
        if (columnResult.percent < 100 && mergedResult.percent >= 100) {
          divergent.push({
            name: (sp.displayName ?? sp.user.name ?? "").trim() || "Dogsitter",
            email: sp.user.email,
            columnPercent: columnResult.percent,
            mergedPercent: mergedResult.percent,
          });
        }
        continue;
      }

      // GUARD-RAIL #2: if the merged source disagrees with the column on
      // ANY check (e.g. column says pricing missing, JSON says pricing
      // filled), we abstain from sending. The sitter would receive a
      // contradictory message; better to stay silent and flag for review.
      const columnMissing = Object.entries(columnResult.checks)
        .filter(([, ok]) => !ok)
        .map(([key]) => key)
        .sort()
        .join(",");
      const mergedMissing = Object.entries(mergedResult.checks)
        .filter(([, ok]) => !ok)
        .map(([key]) => key)
        .sort()
        .join(",");
      if (columnMissing !== mergedMissing) {
        results.skippedAlreadyComplete++;
        divergent.push({
          name: (sp.displayName ?? sp.user.name ?? "").trim() || "Dogsitter",
          email: sp.user.email,
          columnPercent: columnResult.percent,
          mergedPercent: mergedResult.percent,
        });
        continue;
      }

      // From here we use the merged snapshot — both sources agree, so
      // there's no risk of the email contradicting the dashboard.
      const completion = mergedResult.percent;
      const checks = mergedResult.checks;

      // Skip when the ONLY remaining check is Stripe Connect and everything
      // else (7/8) is done. Stripe Connect is an external step (bank account
      // verification) that the sitter mentally separates from "filling out
      // the profile". Pushing a "you're at 87 % — finish your profile" email
      // is misleading and frustrating. The dashboard's getHostTodos() still
      // surfaces "Configurer le compte de paiement" → /host/wallet, which is
      // the right place for that nudge. See:
      // docs/bugs/onboarding-nudge-stripe-only.md
      const checksList = Object.entries(checks);
      const missing = checksList.filter(([, ok]) => !ok).map(([key]) => key);
      if (missing.length === 1 && missing[0] === "stripeConnected") {
        results.skippedAlreadyComplete++;
        continue;
      }
      void completion;

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
        // Email body is built from the MERGED snapshot — same data the
        // dashboard shows, so the checklist matches what the sitter sees.
        profile: mergedSnapshot,
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
      // Human-readable labels (French, plain words) — the Telegram message
      // goes to the founder, not engineers. "day_3" is a code, "rappel J+3"
      // is what a human reads.
      const stageEmoji: Record<string, string> = {
        welcome: "👋",
        day_1: "📅",
        day_3: "📅",
        day_7: "📅",
        day_14: "🚨",
      };
      const stageLabel: Record<string, string> = {
        welcome: "Email de bienvenue",
        day_1: "Rappel J+1",
        day_3: "Rappel J+3",
        day_7: "Rappel J+7",
        day_14: "Dernier rappel (J+14)",
      };
      const actionLine =
        results.errors > 0
          ? `⚠️ <b>Action requise : OUI</b> — ${pluralFR(results.errors, "envoi a échoué", "envois ont échoué")}, regarde le détail.`
          : `✅ <b>Action requise : NON</b> — ${pluralFR(results.sent, "email de relance envoyé", "emails de relance envoyés")} aux sitters activés mais pas encore publiés.`;
      const message = tgMessage([
        tgHeader("💌", "Emails de relance envoyés aux sitters"),
        actionLine,
        [
          tgSection("📊", "Résumé"),
          `${pluralFR(results.candidatesFound, "sitter", "sitters")} sans profil publié examiné${results.candidatesFound !== 1 ? "s" : ""}`,
          `✅ ${pluralFR(results.sent, "email envoyé", "emails envoyés")} · ⏭ ${pluralFR(results.skippedAlreadyComplete + results.skippedNoStageDue, "sitter pas relancé aujourd'hui", "sitters pas relancés aujourd'hui")}${results.errors > 0 ? ` · ⚠️ ${pluralFR(results.errors, "erreur")}` : ""}`,
        ],
        sentDetails.length > 0
          ? [
              tgSection("📤", "Détail des envois"),
              ...sentDetails.map(
                (d) => {
                  const label = stageLabel[d.stage] ?? d.stage;
                  return `${stageEmoji[d.stage] ?? "📨"} <b>${escapeHtml(label)}</b> → ${escapeHtml(d.name)} (${escapeHtml(d.email)})`;
                },
              ),
              "",
              `<i>Les rappels s'arrêtent automatiquement dès que le sitter complète son profil à 100 % et publie son annonce.</i>`,
            ]
          : null,
        tgFooter(),
      ]);
      telegramSent = await sendTelegramMessage(message, {
        bot: "relances",
        parseMode: "HTML",
      });
    }

    // Surface JSON-vs-column divergences to the maintenance bot so the
    // operator can investigate. Each entry is a sitter whose email we
    // suppressed because the two sources disagreed. AWAITED.
    let telegramDivergenceSent = false;
    if (divergent.length > 0) {
      const lines = divergent.map(
        (d) =>
          `🟡 ${escapeHtml(d.name)} (${escapeHtml(d.email)}) — colonne ${d.columnPercent}% vs merge ${d.mergedPercent}%`,
      );
      const message = tgMessage([
        tgHeader("⚠️", "Onboarding nudge — emails évités (divergence JSON / colonnes)"),
        `🟢 <b>Action requise : NON</b> — ${pluralFR(divergent.length, "sitter a évité un email injuste", "sitters ont évité un email injuste")} grâce au guard-rail. À investiguer côté écriture du profil quand tu auras 5 min.`,
        [tgSection("📋", "Détail"), ...lines],
        tgFooter(),
      ]);
      telegramDivergenceSent = await sendTelegramMessage(message, {
        bot: "maintenance",
        parseMode: "HTML",
      });
    }

    console.log("[cron][sitter-onboarding-nudge] done", {
      ...results,
      telegramSent,
      telegramDivergenceSent,
      divergentCount: divergent.length,
    });
    return NextResponse.json({
      ok: true,
      telegramSent,
      telegramDivergenceSent,
      ...results,
      divergentCount: divergent.length,
    });
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
