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

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const day = now.getDate().toString().padStart(2, "0");
  const month = MONTHS_FR[now.getMonth()];
  const year = now.getFullYear();
  const dateStr = `${day} ${month} ${year}`;

  // Idempotency: skip if today's recap was already sent (Vercel may retry)
  const todayKey = `maintenance-recap-${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${day}`;
  const alreadySent = await prisma.agentLog.findFirst({
    where: { agentName: todayKey, status: "success" },
  });
  if (alreadySent) {
    return NextResponse.json({ success: true, skipped: true, reason: "already sent today" });
  }

  try {
    const [agentLogs, newBookings, confirmedBookings, pendingApps, lastDepsRun] =
      await Promise.all([
        // Agent runs in last 24h grouped by status
        prisma.agentLog.groupBy({
          by: ["status"],
          where: { createdAt: { gte: since24h } },
          _count: { status: true },
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
        // Last deps-agent run
        prisma.agentLog.findFirst({
          where: { agentName: "deps-agent" },
          orderBy: { createdAt: "desc" },
          select: { status: true, createdAt: true, summary: true },
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

    // Format last deps run
    let depsLine = "— aucun run enregistré";
    if (lastDepsRun) {
      const depsAgo = Math.round(
        (now.getTime() - new Date(lastDepsRun.createdAt).getTime()) / 3_600_000,
      );
      const depsIcon = lastDepsRun.status === "success" ? "✅" : "❌";
      depsLine = `${depsIcon} il y a ${depsAgo}h — ${lastDepsRun.summary.slice(0, 50)}`;
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
      ``,
      `📅 <b>Réservations (24h)</b>`,
      `${newBookings} nouvelle${newBookings !== 1 ? "s" : ""} · ${confirmedBookings} confirmée${confirmedBookings !== 1 ? "s" : ""}/payée${confirmedBookings !== 1 ? "s" : ""}`,
      ``,
      `👤 <b>Candidatures</b>`,
      `${pendingApps} en attente de traitement`,
      ``,
      `📦 <b>Deps Agent</b>`,
      depsLine,
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
