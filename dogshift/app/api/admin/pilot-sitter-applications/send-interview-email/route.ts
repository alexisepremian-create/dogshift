import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { logAdminAudit } from "@/lib/audit";
import { reportApiError } from "@/lib/observability/reportApiError";
import { prisma } from "@/lib/prisma";
import { sendInterviewEmail } from "@/lib/sitterApplication/sendInterviewEmail";
import { baseUrlFromRequest } from "@/lib/url/baseUrlFromRequest";

export const runtime = "nodejs";

const ROUTE = "admin.pilot-sitter-applications.send-interview-email";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Sends the "HIGH" interview-booking email (same template as the n8n scoring
 * workflow) to the candidate associated with the given application id.
 *
 * Contract decided with product (2026-04-24):
 *  - The per-candidate Calendly link must already be stored on the
 *    PilotSitterApplication (`calendlyLink`). Without it the endpoint returns
 *    `MISSING_CALENDLY_LINK` so the admin UI can guide the operator.
 *  - Re-sending is always allowed (admin decides). The caller is expected to
 *    confirm re-sends client-side using `acceptedEmailSentAt`.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getRequestAdminAccess(req);
    if (!admin.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { id?: string } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const application = await (prisma as unknown as {
      pilotSitterApplication: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          calendlyLink: string | null;
          acceptedEmailSentAt: Date | null;
          acceptedEmailSource: string | null;
        } | null>;
      };
    }).pilotSitterApplication.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        calendlyLink: true,
        acceptedEmailSentAt: true,
        acceptedEmailSource: true,
      },
    });

    if (!application) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (!application.email) {
      return NextResponse.json({ ok: false, error: "MISSING_EMAIL" }, { status: 409 });
    }

    const calendlyLink = (application.calendlyLink ?? "").trim();
    if (!calendlyLink || !isHttpUrl(calendlyLink)) {
      return NextResponse.json({ ok: false, error: "MISSING_CALENDLY_LINK" }, { status: 409 });
    }

    const baseUrl = baseUrlFromRequest(req) || "https://www.dogshift.ch";
    const result = await sendInterviewEmail({
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      calendlyLink,
      baseUrl,
      applicationId: application.id,
      source: "admin",
    });

    void logAdminAudit({
      action: "communications.email_sent",
      adminUserId: admin.userId,
      targetId: application.id,
      targetType: "PILOT_SITTER_APPLICATION",
      detail: {
        kind: "interview_email",
        source: "admin",
        mode: result.mode,
        previouslySentAt: application.acceptedEmailSentAt?.toISOString() ?? null,
        previousSource: application.acceptedEmailSource ?? null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        mode: result.mode,
        messageId: result.messageId,
        acceptedEmailSentAt: result.acceptedEmailSentAt?.toISOString() ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[api][admin][pilot-sitter-applications][send-interview-email] error", { message });
    reportApiError({
      kind: "upstream_error",
      code: "EMAIL_SEND_FAILED",
      route: ROUTE,
      extra: { message },
    });
    return NextResponse.json({ ok: false, error: "EMAIL_SEND_FAILED" }, { status: 500 });
  }
}
