import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
import { reportApiError } from "@/lib/observability/reportApiError";
import { zodParse } from "@/lib/validators/common";
import { savedSearchSchema } from "@/lib/validators/adoption";

export const runtime = "nodejs";

/** How many alerts one account can run. Enough for "un petit chien VD/GE/FR". */
const MAX_SAVED_SEARCHES = 5;

/**
 * Saved searches drive the alert cron (PR4). They exist because the good dogs
 * are gone within a day: without an alert, adopters have to poll the feed, and
 * the ones who don't poll simply never see the match.
 */
export async function GET() {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const searches = await prisma.adoptionSavedSearch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, searches });
  } catch (err) {
    console.error("[GET /api/adoption/saved-searches]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.savedSearches.list" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const parsed = zodParse(savedSearchSchema, await req.json().catch(() => null), {
      route: "adoption.savedSearches.create",
    });
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const count = await prisma.adoptionSavedSearch.count({ where: { userId: user.id } });
    if (count >= MAX_SAVED_SEARCHES) {
      return NextResponse.json({ ok: false, error: "TOO_MANY_SAVED_SEARCHES" }, { status: 409 });
    }

    const search = await prisma.adoptionSavedSearch.create({
      data: {
        userId: user.id,
        label: body.label ?? null,
        filters: body.filters,
        alertsOn: body.alertsOn ?? true,
        // Watermark starts now: an alert must never fire for listings that were
        // already on the feed when the search was created.
        lastNotifiedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, search }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/adoption/saved-searches]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.savedSearches.create" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** DELETE ?id=… — drop a saved search (and its alerts). */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthedDbUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

    const deleted = await prisma.adoptionSavedSearch.deleteMany({ where: { id, userId: user.id } });
    if (deleted.count === 0) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/adoption/saved-searches]", err);
    reportApiError({ kind: "internal_error", code: "SERVER_ERROR", route: "adoption.savedSearches.delete" });
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
