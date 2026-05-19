/**
 * Daily Prisma migration drift check.
 *
 * Compares `prisma/migrations/*` (filesystem, bundled at deploy time) with
 * `_prisma_migrations` (DB, what Postgres knows about). Any migration that
 * exists on disk but has no successful row in the table is "pending" — the
 * Vercel build's `prisma migrate deploy` skipped or failed silently on
 * that migration.
 *
 * Posts to the maintenance Telegram bot only when drift is detected
 * (silent on a clean day — the maintenance-recap already covers green
 * proof-of-work).
 *
 * Schedule: 06:53 UTC every day (7 min before maintenance-recap), so the
 * founder sees migration alerts before the regular daily summary.
 *
 * Auth: Bearer CRON_SECRET (Vercel) or MAINTENANCE_API_KEY (manual).
 *
 * Background: 2026-05-19 admin candidatures returned 500 because the
 * 20260518170000_add_address_to_sitter_application migration was never
 * applied on prod despite 4+ post-merge deploys. Root cause unknown
 * (suspect Vercel build cache or Neon connection issue during deploy);
 * this cron is the safety net.
 * See docs/bugs/prisma-migration-not-applied-on-prod.md
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";
import { reportApiError } from "@/lib/observability/reportApiError";
import { tgFooter, tgHeader, tgSection } from "@/lib/telegram/format";

export const runtime = "nodejs";
export const maxDuration = 60;

function listMigrationsOnDisk(repoRoot: string): string[] {
  const dir = join(repoRoot, "prisma", "migrations");
  try {
    return readdirSync(dir)
      .filter((name) => {
        if (name.startsWith(".") || name === "migration_lock.toml") return false;
        try {
          return statSync(join(dir, name)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
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
    const onDisk = listMigrationsOnDisk(process.cwd());
    const applied = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;

    const appliedSet = new Set(
      applied
        .filter((row) => row.finished_at !== null && row.rolled_back_at === null)
        .map((row) => row.migration_name),
    );

    const pending = onDisk.filter((name) => !appliedSet.has(name));

    const result = {
      ok: true,
      onDisk: onDisk.length,
      applied: appliedSet.size,
      pending,
      pendingCount: pending.length,
      telegramSent: false,
    };

    if (pending.length > 0) {
      const now = new Date();
      const lines = pending.map((name) => `🔴 <code>${name}</code>`);
      const message = [
        tgHeader("🚨", "Migrations Prisma en attente", now),
        "",
        tgSection(
          "📦",
          `${pending.length} migration(s) sur disque non appliquée(s) en prod`,
        ),
        ...lines,
        "",
        tgSection("ℹ️", "Quoi faire"),
        "1. Vérifier <code>_prisma_migrations</code> sur la prod DB",
        "2. Appliquer manuellement ou relancer <code>prisma migrate deploy</code>",
        "3. Voir <code>docs/bugs/prisma-migration-not-applied-on-prod.md</code>",
        "",
        tgFooter(now),
      ].join("\n");

      result.telegramSent = await sendTelegramMessage(message, {
        bot: "maintenance",
        parseMode: "HTML",
      });

      reportApiError({
        kind: "internal_error",
        code: "PRISMA_MIGRATION_DRIFT",
        route: "/api/cron/prisma-migration-status",
        extra: { pending, telegramSent: result.telegramSent },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const e = err as { message?: string; code?: string };
    console.error(
      "[api][cron][prisma-migration-status] error",
      JSON.stringify({ code: e?.code, message: e?.message }),
    );
    reportApiError({
      kind: "internal_error",
      code: "PRISMA_MIGRATION_STATUS_CHECK_FAILED",
      route: "/api/cron/prisma-migration-status",
      extra: { error: String(err) },
    });
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
