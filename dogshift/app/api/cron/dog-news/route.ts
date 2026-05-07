import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { runDogNewsAgent } from "@/lib/agents/dogNewsAgent";
import { reportApiError } from "@/lib/observability/reportApiError";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Vercel cron authentication
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    const report = await runDogNewsAgent();

    const durationMs = Date.now() - start;

    await prisma.agentLog.create({
      data: {
        agentName: "dog-news",
        actionType: "daily_news_report",
        summary: `${report.itemCount} actualités récupérées, rapport envoyé sur Telegram`,
        details: {
          itemCount: report.itemCount,
          date: report.date,
          messageLength: report.telegramMessage.length,
          durationMs,
        },
        durationMs,
        status: "success",
      },
    });

    return NextResponse.json({
      success: true,
      itemCount: report.itemCount,
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    const message = error instanceof Error ? error.message : String(error);

    reportApiError({ kind: "internal_error", route: "cron/dog-news", extra: { error: message } });

    await prisma.agentLog.create({
      data: {
        agentName: "dog-news",
        actionType: "daily_news_report",
        summary: `Erreur : ${message}`,
        details: { error: message, durationMs },
        durationMs,
        status: "error",
      },
    }).catch(() => {});

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
