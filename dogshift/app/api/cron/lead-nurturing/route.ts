/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { reportApiError } from "@/lib/observability/reportApiError";
import {
  renderNurturingStep1,
  renderNurturingStep2,
  renderNurturingStep3,
} from "@/lib/email/templates/leadNurturingEmail";

export const runtime = "nodejs";

const STEP_DELAYS_MS = [
  0,            // step 0 → 1 : délai basé sur capturedAt + 1 jour
  2 * 86400e3,  // step 1 → 2 : 2 jours après lastNurturingAt (J+3 total)
  4 * 86400e3,  // step 2 → 3 : 4 jours après lastNurturingAt (J+7 total)
] as const;

const STEP_1_DELAY_MS = 86400e3; // 1 jour après capturedAt

const BATCH_SIZE = 50;

const SUBJECTS: Record<number, string> = {
  1: "Avez-vous eu le temps de lire votre guide ?",
  2: "Ce que disent les autres propriétaires de DogShift",
  3: "Votre chien mérite le meilleur sitter",
};

function baseUrl() {
  return (
    (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "https://dogshift.ch")
      .replace(/\/$/, "")
  );
}

function readCronSecret(req: NextRequest) {
  const header = (req.headers.get("x-cron-secret") || "").trim();
  if (header) return header;
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

function renderStep(step: number, params: { baseUrl: string; prenom?: string }) {
  switch (step) {
    case 1: return renderNurturingStep1(params);
    case 2: return renderNurturingStep2(params);
    case 3: return renderNurturingStep3(params);
    default: return null;
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && readCronSecret(req) !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const base = baseUrl();
  const now = Date.now();

  const stats = { sent: 0, skipped: 0, errors: 0 };

  try {
    // ── Step 0 → 1 : leads ayant reçu le guide il y a > 1 jour ──────────────
    const step1Candidates = await (prisma as any).leadMagnet.findMany({
      where: {
        nurturingStep: 0,
        unsubscribed: false,
        capturedAt: { lte: new Date(now - STEP_1_DELAY_MS) },
      },
      take: BATCH_SIZE,
      orderBy: { capturedAt: "asc" },
    });

    for (const lead of step1Candidates) {
      try {
        const rendered = renderStep(1, { baseUrl: base, prenom: lead.prenom ?? undefined });
        if (!rendered) continue;
        await sendEmail({
          to: lead.email,
          subject: SUBJECTS[1],
          html: rendered.html,
          text: `Bonjour${lead.prenom ? ` ${lead.prenom}` : ""},\n\nAvez-vous eu le temps de lire votre guide DogShift ?\n\nVoir les sitters : ${base}/sitters\n\n— DogShift\n`,
        });
        await (prisma as any).leadMagnet.update({
          where: { id: lead.id },
          data: { nurturingStep: 1, lastNurturingAt: new Date() },
        });
        stats.sent++;
      } catch (err) {
        console.error("[lead-nurturing] step 1 error", { id: lead.id, err });
        stats.errors++;
      }
    }

    // ── Step 1 → 2 : 2 jours après lastNurturingAt ──────────────────────────
    const step2Candidates = await (prisma as any).leadMagnet.findMany({
      where: {
        nurturingStep: 1,
        unsubscribed: false,
        lastNurturingAt: { lte: new Date(now - STEP_DELAYS_MS[1]) },
      },
      take: BATCH_SIZE,
      orderBy: { lastNurturingAt: "asc" },
    });

    for (const lead of step2Candidates) {
      try {
        const rendered = renderStep(2, { baseUrl: base, prenom: lead.prenom ?? undefined });
        if (!rendered) continue;
        await sendEmail({
          to: lead.email,
          subject: SUBJECTS[2],
          html: rendered.html,
          text: `Bonjour${lead.prenom ? ` ${lead.prenom}` : ""},\n\nVoici ce que pensent les autres propriétaires de DogShift.\n\nTrouver un sitter : ${base}/sitters\n\n— DogShift\n`,
        });
        await (prisma as any).leadMagnet.update({
          where: { id: lead.id },
          data: { nurturingStep: 2, lastNurturingAt: new Date() },
        });
        stats.sent++;
      } catch (err) {
        console.error("[lead-nurturing] step 2 error", { id: lead.id, err });
        stats.errors++;
      }
    }

    // ── Step 2 → 3 : 4 jours après lastNurturingAt ──────────────────────────
    const step3Candidates = await (prisma as any).leadMagnet.findMany({
      where: {
        nurturingStep: 2,
        unsubscribed: false,
        lastNurturingAt: { lte: new Date(now - STEP_DELAYS_MS[2]) },
      },
      take: BATCH_SIZE,
      orderBy: { lastNurturingAt: "asc" },
    });

    for (const lead of step3Candidates) {
      try {
        const rendered = renderStep(3, { baseUrl: base, prenom: lead.prenom ?? undefined });
        if (!rendered) continue;
        await sendEmail({
          to: lead.email,
          subject: SUBJECTS[3],
          html: rendered.html,
          text: `Bonjour${lead.prenom ? ` ${lead.prenom}` : ""},\n\nVotre chien mérite le meilleur sitter. Retrouvez nos sitters vérifiés sur DogShift.\n\n${base}/sitters\n\n— DogShift\n`,
        });
        await (prisma as any).leadMagnet.update({
          where: { id: lead.id },
          data: { nurturingStep: 3, lastNurturingAt: new Date() },
        });
        stats.sent++;
      } catch (err) {
        console.error("[lead-nurturing] step 3 error", { id: lead.id, err });
        stats.errors++;
      }
    }

    console.log("[cron][lead-nurturing] done", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    reportApiError({
      kind: "internal_error",
      route: "GET /api/cron/lead-nurturing",
      extra: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
