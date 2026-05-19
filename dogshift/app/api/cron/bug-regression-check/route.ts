/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Nightly bug regression check.
 *
 * Reads every fiche under `docs/bugs/*.md`, runs the optional
 * `## 🤖 Automated detection` block (HTTP probe or SQL query), and posts
 * a recap to the maintenance Telegram bot. Always sends the recap, even
 * on a green night — that's the "proof of work" requested by the founder.
 *
 * Schedule: 02:07 UTC every day (see vercel.json). Off-minute by design
 * to spread load across Vercel's cron fleet.
 *
 * Auth: Bearer CRON_SECRET (Vercel cron) or MAINTENANCE_API_KEY (manual
 * trigger via curl / GitHub Actions).
 *
 * Idempotency: writes one AgentLog row per UTC day. Re-running the same
 * day is a no-op unless `?force=1` is passed.
 *
 * Failure handling: if any single fiche check throws, that fiche's outcome
 * is `error` and the cron still completes. We never short-circuit on one
 * bad fiche.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { reportApiError } from "@/lib/observability/reportApiError";

import { parseBugFiches } from "@/lib/bugRegression/parseBugFiches";
import { runAll } from "@/lib/bugRegression/runDetections";
import { formatRecap } from "@/lib/bugRegression/telegramRecap";

export const runtime = "nodejs";
export const maxDuration = 300;

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
      if (!isInitErr) throw err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr ?? new Error("Prisma warm-up failed");
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

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const todayKey = new Date().toISOString().slice(0, 10);

  try {
    await ensurePrismaWarm();
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      code: "BUG_REGRESSION_PRISMA_WARM_FAILED",
      route: "/api/cron/bug-regression-check",
      extra: { error: String(err) },
    });
    return NextResponse.json(
      { ok: false, error: "PRISMA_WARM_FAILED" },
      { status: 500 },
    );
  }

  // Idempotency — but always allow a force re-run for manual testing.
  if (!force) {
    const already = await (prisma as any).agentLog.findFirst({
      where: { agentName: "bug-regression-check", actionType: todayKey },
    });
    if (already) {
      return NextResponse.json({
        ok: true,
        skipped: "already_ran_today",
        runAt: already.createdAt,
      });
    }
  }

  // Parse + run.
  const repoRoot = process.cwd();
  const fiches = parseBugFiches(repoRoot);
  const results = await runAll(fiches);

  const failures = results.filter((r) => r.outcome.status === "fail").length;
  const errors = results.filter((r) => r.outcome.status === "error").length;
  const passes = results.filter((r) => r.outcome.status === "pass").length;
  const skipped = results.filter((r) => r.outcome.status === "skipped").length;

  // Telegram recap — ALWAYS AWAITED. Fire-and-forget does not work on Vercel
  // Functions: anything after `return NextResponse.json(…)` runs inside a
  // frozen execution context and is often dropped. The Telegram call MUST
  // complete before the route returns, even if it costs ~500 ms.
  // `sendTelegramMessage` returns `false` on failure (never throws) so we
  // capture the boolean and persist it for audit.
  const message = formatRecap(results, new Date());
  let telegramSent = false;
  try {
    telegramSent = await sendTelegramMessage(message, {
      bot: "maintenance",
      parseMode: "HTML",
    });
  } catch (err) {
    // Defensive — sendTelegramMessage catches internally but just in case.
    reportApiError({
      kind: "upstream_error",
      code: "BUG_REGRESSION_TELEGRAM_FAILED",
      route: "/api/cron/bug-regression-check",
      extra: { error: String(err) },
    });
  }
  if (!telegramSent) {
    reportApiError({
      kind: "upstream_error",
      code: "BUG_REGRESSION_TELEGRAM_DROPPED",
      route: "/api/cron/bug-regression-check",
      extra: {
        runDate: todayKey,
        summary: { total: results.length, passes, failures, errors, skipped },
      },
    });
  }

  // Persist for audit + idempotency. Done AFTER Telegram so the row carries
  // the telegram status — easier to debug "did the message go out?" later.
  await (prisma as any).agentLog.create({
    data: {
      agentName: "bug-regression-check",
      actionType: todayKey,
      summary: `Ran ${results.length} fiche checks: ${passes} pass, ${failures} fail, ${errors} error, ${skipped} skipped. Telegram ${telegramSent ? "sent" : "DROPPED"}.`,
      status: failures > 0 || errors > 0 ? "warning" : "success",
      details: {
        runDate: todayKey,
        telegramSent,
        results: results.map((r) => ({
          slug: r.slug,
          status: r.outcome.status,
          detail: r.outcome.detail,
          autoFixComplexity: r.detection?.auto_fix?.complexity ?? null,
        })),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    runDate: todayKey,
    telegramSent,
    summary: { total: results.length, passes, failures, errors, skipped },
    results: results.map((r) => ({
      slug: r.slug,
      status: r.outcome.status,
      detail: r.outcome.detail,
    })),
    repoRoot,
  });
}
