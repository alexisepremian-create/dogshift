import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { logAdminAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Stores a per-candidate Calendly link on a pilot sitter application.
 * Accepts an empty string to clear the link.
 *
 * Used by the admin UI so "Accepté" can trigger the interview-booking email
 * with a candidate-specific Calendly URL (one link per flow / per sitter
 * tier).
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getRequestAdminAccess(req);
    if (!admin.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      id?: string;
      calendlyLink?: string | null;
    } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const rawLink = typeof body?.calendlyLink === "string" ? body.calendlyLink.trim() : "";

    if (!id) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    // Allow clearing: empty string → null.
    const nextValue = rawLink === "" ? null : rawLink;
    if (nextValue && !isHttpUrl(nextValue)) {
      return NextResponse.json({ ok: false, error: "INVALID_URL" }, { status: 400 });
    }
    if (nextValue && nextValue.length > 2048) {
      return NextResponse.json({ ok: false, error: "URL_TOO_LONG" }, { status: 400 });
    }

    await (prisma as unknown as {
      pilotSitterApplication: {
        update: (args: unknown) => Promise<{ id: string }>;
      };
    }).pilotSitterApplication.update({
      where: { id },
      data: { calendlyLink: nextValue },
      select: { id: true },
    });

    void logAdminAudit({
      action: "application.status_change",
      adminUserId: admin.userId,
      targetId: id,
      targetType: "PILOT_SITTER_APPLICATION",
      detail: { kind: "calendly_link_update", hasLink: nextValue != null },
    });

    return NextResponse.json({ ok: true, calendlyLink: nextValue }, { status: 200 });
  } catch (err) {
    console.error("[api][admin][pilot-sitter-applications][calendly-link][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
