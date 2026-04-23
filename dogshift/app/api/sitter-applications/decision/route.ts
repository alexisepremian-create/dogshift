import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import {
  APPLICATION_DECISION_VALUES,
  applicationDecisionToStatus,
} from "@/lib/sitterApplication/decisionStatus";
import { logAdminAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ROUTE = "sitter-applications.decision";

// Shared with /api/emails/send-application-email so the n8n workflow only needs
// one secret. Accepts either `x-webhook-secret: <secret>` or
// `Authorization: Bearer <secret>` to match the cron endpoints convention.
function readWebhookSecret(req: NextRequest): string {
  const header = (req.headers.get("x-webhook-secret") || "").trim();
  if (header) return header;

  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

const decisionBodySchema = z.object({
  applicationId: z.string().trim().min(1, "applicationId requis"),
  decision: z.enum(APPLICATION_DECISION_VALUES),
});

export async function POST(req: NextRequest) {
  // ---------------------------------------------------------------------------
  // 1. Webhook auth (shared N8N_WEBHOOK_SECRET)
  // ---------------------------------------------------------------------------
  const configuredSecret = (process.env.N8N_WEBHOOK_SECRET || "").trim();
  if (!configuredSecret) {
    console.error("[api][sitter-applications][decision] N8N_WEBHOOK_SECRET missing");
    return NextResponse.json(
      { ok: false, error: "MISSING_N8N_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const providedSecret = readWebhookSecret(req);
  if (!providedSecret || providedSecret !== configuredSecret) {
    reportApiError({
      kind: "unauthorized",
      code: "UNAUTHORIZED",
      route: ROUTE,
      extra: { hasHeader: Boolean(providedSecret) },
    });
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // ---------------------------------------------------------------------------
  // 2. Body parsing + validation
  // ---------------------------------------------------------------------------
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    reportApiError({ kind: "validation_error", code: "INVALID_JSON", route: ROUTE });
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = zodParse(decisionBodySchema, rawBody, { route: ROUTE });
  if (!parsed.ok) return parsed.response;

  const { applicationId, decision } = parsed.data;
  const nextStatus = applicationDecisionToStatus(decision);

  // ---------------------------------------------------------------------------
  // 3. Update — preserve existing status if it's already in a later lifecycle
  //    stage (ACTIVATED must never be regressed by an automated rescoring).
  // ---------------------------------------------------------------------------
  try {
    const db = prisma as unknown as {
      pilotSitterApplication: {
        findUnique: (args: unknown) => Promise<{ id: string; status: string } | null>;
        update: (args: unknown) => Promise<{ id: string; status: string }>;
      };
    };

    const current = await db.pilotSitterApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true },
    });

    if (!current) {
      reportApiError({
        kind: "not_found",
        code: "APPLICATION_NOT_FOUND",
        route: ROUTE,
        extra: { applicationId },
      });
      return NextResponse.json(
        { ok: false, error: "APPLICATION_NOT_FOUND" },
        { status: 404 },
      );
    }

    // Guard: never regress an ACTIVATED sitter back to CONTACTED/REJECTED on
    // a re-scoring. Admins own those transitions from the panel.
    if (current.status === "ACTIVATED") {
      return NextResponse.json(
        { ok: true, status: current.status, skipped: "ACTIVATED_KEPT" },
        { status: 200 },
      );
    }

    // Idempotency: if the status is already what we'd set, short-circuit.
    if (current.status === nextStatus) {
      return NextResponse.json(
        { ok: true, status: current.status, skipped: "NO_CHANGE" },
        { status: 200 },
      );
    }

    const updated = await db.pilotSitterApplication.update({
      where: { id: applicationId },
      data: { status: nextStatus },
      select: { id: true, status: true },
    });

    logAdminAudit({
      action: "application.status_change",
      adminUserId: null,
      targetId: applicationId,
      targetType: "PILOT_SITTER_APPLICATION",
      detail: {
        newStatus: nextStatus,
        previousStatus: current.status,
        source: "n8n.decision",
        decision,
      },
    });

    console.log("[api][sitter-applications][decision] updated", {
      applicationId,
      decision,
      previousStatus: current.status,
      newStatus: updated.status,
    });

    return NextResponse.json(
      { ok: true, status: updated.status, decision },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[api][sitter-applications][decision] error", { applicationId, decision, message });
    reportApiError({
      kind: "internal_error",
      code: "INTERNAL_ERROR",
      route: ROUTE,
      extra: { applicationId, decision, message },
    });
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
