import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";
export const maxDuration = 60;

const MONTHS_FR = [
  "jan", "fév", "mar", "avr", "mai", "jun",
  "jul", "aoû", "sep", "oct", "nov", "déc",
];

/**
 * Wakes the Neon DB up before issuing the real recap queries.
 *
 * The recap cron fires at 07:00 UTC after a quiet European night, when Neon
 * has typically autosuspended the compute. The first connection then races
 * against the wake-up and times out with PrismaClientInitializationError. We
 * issue a deliberately tiny query, retry it a few times with backoff, and
 * only then let the rest of the handler run.
 *
 * Retries are intentionally synchronous-looking: 3 attempts spaced 1.5s
 * apart covers ~5s of Neon wake-up budget. If all three fail, we surface
 * the error to the caller so Vercel marks the cron as failed (visible in
 * monitoring), instead of pretending success and silently dropping the
 * day's Telegram recap.
 */
async function ensurePrismaWarm(): Promise<void> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      return;
    } catch (err) {
      lastErr = err;
      const isInitErr =
        err instanceof Error &&
        (err.name === "PrismaClientInitializationError" ||
          /can't reach database|connection|timeout/i.test(err.message));
      if (!isInitErr) throw err; // unrelated error → don't retry
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr ?? new Error("Prisma warm-up failed");
}

export async function GET(req: Request) {
  // Accept either the CRON_SECRET (used by Vercel cron) or the
  // MAINTENANCE_API_KEY (used by GitHub Actions + by manual ops triggers
  // when we need to force a re-send for testing).
  const authHeader = req.headers.get("authorization") ?? "";
  const cronBearer = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const maintBearer = `Bearer ${(process.env.MAINTENANCE_API_KEY ?? "").trim()}`;
  const isAuthorized =
    (process.env.CRON_SECRET && authHeader === cronBearer) ||
    (process.env.MAINTENANCE_API_KEY && authHeader === maintBearer);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Wake Neon up before any real query (see ensurePrismaWarm comment).
  try {
    await ensurePrismaWarm();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron][maintenance-recap] Prisma warm-up failed after retries", { message });
    reportApiError({
      kind: "internal_error",
      route: "cron/maintenance-recap",
      extra: { stage: "warmup", error: message },
    });
    return NextResponse.json({ success: false, error: "DB unreachable" }, { status: 503 });
  }

  // ?force=1 bypasses the same-day idempotency guard. Useful for ops to
  // verify recap formatting changes without waiting 24h, or to re-run after
  // a partial send. Still requires a valid Bearer above, so this is not
  // publicly abusable.
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const day = now.getDate().toString().padStart(2, "0");
  const month = MONTHS_FR[now.getMonth()];
  const year = now.getFullYear();
  const dateStr = `${day} ${month} ${year}`;

  // Idempotency: skip if today's recap was already sent (Vercel may retry)
  const todayKey = `maintenance-recap-${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${day}`;
  if (!force) {
    const alreadySent = await prisma.agentLog.findFirst({
      where: { agentName: todayKey, status: "success" },
    });
    if (alreadySent) {
      return NextResponse.json({ success: true, skipped: true, reason: "already sent today" });
    }
  }

  try {
    const [
      agentLogs,
      agentBreakdown,
      newBookings,
      confirmedBookings,
      pendingApps,
      lastNightlyRun,
      lastWeeklyRun,
    ] = await Promise.all([
      // Agent runs in last 24h grouped by status (errors / success counter)
      prisma.agentLog.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since24h } },
        _count: { status: true },
      }),
      // Per-agent breakdown for the FR detail line
      prisma.agentLog.groupBy({
        by: ["agentName"],
        where: { createdAt: { gte: since24h } },
        _count: { agentName: true },
      }),
      // New bookings (any status) in last 24h
      prisma.booking.count({
        where: { createdAt: { gte: since24h } },
      }),
      // Paid/confirmed bookings in last 24h
      prisma.booking.count({
        where: {
          createdAt: { gte: since24h },
          status: { in: ["PAID", "CONFIRMED"] },
        },
      }),
      // Pending sitter applications
      prisma.pilotSitterApplication.count({
        where: { status: "PENDING" },
      }),
      // Last NIGHTLY deps run (runs at ~04h30 UTC each day)
      prisma.agentLog.findFirst({
        where: { agentName: "deps-agent", actionType: "nightly_update" },
        orderBy: { createdAt: "desc" },
        select: { status: true, createdAt: true, summary: true, details: true },
      }),
      // Last WEEKLY deps deep scan (Mondays ~07h UTC)
      prisma.agentLog.findFirst({
        where: { agentName: "deps-agent", actionType: "weekly_report" },
        orderBy: { createdAt: "desc" },
        select: { status: true, createdAt: true, summary: true, details: true },
      }),
    ]);

    const successCount =
      agentLogs.find((l) => l.status === "success")?._count.status ?? 0;
    const errorCount =
      agentLogs.find((l) => l.status === "error")?._count.status ?? 0;
    const totalRuns = successCount + errorCount;

    // Fetch recent errors for the detail section
    const recentErrors =
      errorCount > 0
        ? await prisma.agentLog.findMany({
            where: { status: "error", createdAt: { gte: since24h } },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { agentName: true, summary: true },
          })
        : [];

    // ── Per-agent detail line (FR) ────────────────────────────────────────
    // Lists which agents ran in the last 24h with their run counts. Sorted by
    // count descending, capped at the 4 most active so the Telegram message
    // stays scannable on mobile.
    const HUMAN_AGENT_NAMES: Record<string, string> = {
      "candidature": "Candidature",
      "candidature-enriched": "Candidature (enrichie)",
      "calendrier": "Calendrier",
      "contrat": "Contrat",
      "activation": "Activation",
      "onboarding-owner": "Onboarding owner",
      "relance-owner": "Relance owner",
      "lead-magnet": "Lead magnet",
      "zootherapie-evaluation": "Zoothérapie",
      "deps-agent": "Deps",
      "auth-health-check": "Auth health",
      "dog-news": "Veille canine",
    };
    const agentDetailParts = agentBreakdown
      .filter((a) => !a.agentName.startsWith("maintenance-recap-")) // hide self
      .sort((a, b) => b._count.agentName - a._count.agentName)
      .slice(0, 4)
      .map((a) => `${HUMAN_AGENT_NAMES[a.agentName] ?? a.agentName} (${a._count.agentName})`);
    const agentDetailLine =
      agentDetailParts.length > 0
        ? `<i>${agentDetailParts.join(" · ")}</i>`
        : `<i>Aucun agent n'a tourné — vérifie les crons Vercel</i>`;

    // ── Deps Agent section: nightly + weekly with actionable FR text ──────
    // Distinguishes the two cadences: the nightly scan (every night ~04h30
    // UTC, auto-updates non-sensitive deps) vs the Monday deep scan (weekly
    // changelog review by Claude with risk levels). Telling the user what
    // to DO matters more than "il y a Xh", which is unactionable noise.
    type WeeklyPkg = { pkg: string; risk?: string; releases?: number };
    type AgentLogDetails = { packages?: WeeklyPkg[] } | null | undefined;

    const depsLines: string[] = [];

    // Nightly status
    if (lastNightlyRun) {
      const hoursAgo = Math.round(
        (now.getTime() - new Date(lastNightlyRun.createdAt).getTime()) / 3_600_000,
      );
      const summary = lastNightlyRun.summary ?? "";
      const isUpToDate = /0 outdated/i.test(summary) || /up to date/i.test(summary);
      if (hoursAgo > 30) {
        // Nightly is supposed to run every ~24h. Past 30h = something broke.
        depsLines.push(`⚠️ <b>Scan nocturne</b> : silence depuis ${hoursAgo}h`);
        depsLines.push(`   👉 Vérifie GitHub Actions → workflow "Deps Nightly"`);
      } else if (isUpToDate) {
        depsLines.push(`✅ <b>Scan nocturne</b> (cette nuit) : tout est à jour, rien à faire`);
      } else {
        depsLines.push(`📋 <b>Scan nocturne</b> (cette nuit) : ${summary}`);
        depsLines.push(`   👉 Vérifie les PR ouvertes sur GitHub`);
      }
    } else {
      depsLines.push(`⚠️ <b>Scan nocturne</b> : aucun run enregistré`);
      depsLines.push(`   👉 Vérifie le secret <code>MAINTENANCE_API_KEY</code> (Vercel ↔ GitHub Actions)`);
    }

    // Weekly status — only mention if there's data, otherwise it's noise.
    if (lastWeeklyRun) {
      const details = lastWeeklyRun.details as AgentLogDetails;
      const pkgs = Array.isArray(details?.packages) ? details.packages : [];
      const withUpdates = pkgs.filter((p) => (p.releases ?? 0) > 0);

      // Days since last Monday scan (always Monday → reset each week)
      const daysSinceWeekly = Math.floor(
        (now.getTime() - new Date(lastWeeklyRun.createdAt).getTime()) / 86_400_000,
      );
      const todayDow = now.getUTCDay(); // 0 = Sun, 1 = Mon
      const isMondayToday = todayDow === 1;
      const nextScanLabel = isMondayToday
        ? "(prochain : lundi prochain)"
        : `(prochain : lundi)`;

      depsLines.push(``);
      depsLines.push(
        `🗓️ <b>Rapport hebdo</b> ${daysSinceWeekly === 0 ? "(aujourd'hui)" : `(il y a ${daysSinceWeekly}j)`}`,
      );

      if (withUpdates.length === 0) {
        depsLines.push(`✅ Aucun paquet sensible n'a d'update dispo ${nextScanLabel}`);
      } else {
        // Per-package list, sorted by urgency (high → medium → low),
        // alphabetical within each tier. Mirrors the admin panel view —
        // one line per package, color emoji + name + recommended action.
        const actionByRisk = (risk: string): string => {
          if (risk === "high") return "review manuelle obligatoire";
          if (risk === "medium") return "lis le changelog";
          if (risk === "low") return "ok à auto-merger";
          return "";
        };
        const emojiByRisk = (risk: string): string => {
          if (risk === "high") return "🔴";
          if (risk === "medium") return "🟡";
          if (risk === "low") return "🟢";
          return "⚪";
        };
        const rankByRisk = (risk: string): number =>
          risk === "high" ? 0 : risk === "medium" ? 1 : risk === "low" ? 2 : 3;

        const sorted = [...withUpdates].sort((a, b) => {
          const r = rankByRisk(a.risk ?? "") - rankByRisk(b.risk ?? "");
          return r !== 0 ? r : a.pkg.localeCompare(b.pkg);
        });

        depsLines.push(
          `${withUpdates.length} paquet${withUpdates.length > 1 ? "s" : ""} sensible${withUpdates.length > 1 ? "s ont" : " a"} des updates (par urgence) :`,
        );
        for (const pkg of sorted) {
          const risk = pkg.risk ?? "low";
          depsLines.push(
            `   ${emojiByRisk(risk)} <code>${pkg.pkg}</code> — ${actionByRisk(risk)}`,
          );
        }
        depsLines.push(`   👉 Détails sur <a href="https://www.dogshift.ch/admin/maintenance">/admin/maintenance</a>`);
      }
    }

    const agentLine =
      errorCount === 0
        ? `✅ ${totalRuns} run${totalRuns !== 1 ? "s" : ""}, 0 erreur`
        : `⚠️ ${totalRuns} run${totalRuns !== 1 ? "s" : ""}, <b>${errorCount} erreur${errorCount !== 1 ? "s" : ""}</b>`;

    const lines: string[] = [
      `🔧 <b>DogShift Maintenance — ${dateStr}</b>`,
      ``,
      `⚙️ <b>Agents (24h)</b>`,
      agentLine,
      agentDetailLine,
      ``,
      `📅 <b>Réservations (24h)</b>`,
      `${newBookings} nouvelle${newBookings !== 1 ? "s" : ""} · ${confirmedBookings} confirmée${confirmedBookings !== 1 ? "s" : ""}/payée${confirmedBookings !== 1 ? "s" : ""}`,
      ``,
      `👤 <b>Candidatures</b>`,
      `${pendingApps} en attente de traitement`,
      ``,
      `📦 <b>Deps Agent</b>`,
      ...depsLines,
    ];

    if (recentErrors.length > 0) {
      lines.push(``, `🚨 <b>Erreurs récentes</b>`);
      for (const err of recentErrors) {
        lines.push(`• <code>${err.agentName}</code> — ${err.summary.slice(0, 60)}`);
      }
    }

    lines.push(``, `<i>Généré automatiquement · ${dateStr}</i>`);

    await sendTelegramMessage(lines.join("\n"), {
      bot: "maintenance",
      parseMode: "HTML",
    });

    await prisma.agentLog.create({
      data: { agentName: todayKey, actionType: "success", status: "success", summary: `Recap sent for ${dateStr}` },
    });

    return NextResponse.json({
      success: true,
      totalRuns,
      errorCount,
      newBookings,
      pendingApps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportApiError({
      kind: "internal_error",
      route: "cron/maintenance-recap",
      extra: { error: message },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
