import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Politique de rétention : supprimer les entrées du journal d'audit
// de plus de RETENTION_YEARS ans (défaut : 5 ans), conformément à la nLPD/RGPD.
// Ce cron est protégé par CRON_SECRET et planifié mensuellement dans vercel.json.

const RETENTION_YEARS = 5;

function readCronSecret(req: NextRequest): string {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "MISSING_CRON_SECRET" }, { status: 500 });
  }

  const provided = readCronSecret(req);
  if (!provided || provided !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

  try {
    const result = await (prisma as any).auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    console.log("[cron][audit-cleanup] deleted", result.count, "entries older than", cutoff.toISOString());

    return NextResponse.json({
      ok: true,
      deleted: result.count,
      retentionYears: RETENTION_YEARS,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error("[cron][audit-cleanup] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
