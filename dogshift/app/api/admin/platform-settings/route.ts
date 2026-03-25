import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { PLATFORM_SETTINGS_GLOBAL_ID } from "@/lib/platform/maintenanceConstants";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  maintenanceMode?: unknown;
  maintenanceMessage?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const row = await prisma.platformSettings.findUnique({
      where: { id: PLATFORM_SETTINGS_GLOBAL_ID },
    });

    return NextResponse.json(
      {
        ok: true,
        maintenanceMode: Boolean(row?.maintenanceMode),
        maintenanceMessage:
          typeof row?.maintenanceMessage === "string" && row.maintenanceMessage.trim()
            ? row.maintenanceMessage.trim()
            : null,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api][admin][platform-settings][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json()) as PatchBody;
    const hasMode = "maintenanceMode" in body;
    const hasMessage = "maintenanceMessage" in body;

    if (!hasMode && !hasMessage) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const data: { maintenanceMode?: boolean; maintenanceMessage?: string | null } = {};

    if (hasMode) {
      if (typeof body.maintenanceMode !== "boolean") {
        return NextResponse.json({ ok: false, error: "INVALID_MAINTENANCE_MODE" }, { status: 400 });
      }
      data.maintenanceMode = body.maintenanceMode;
    }

    if (hasMessage) {
      if (body.maintenanceMessage === null) {
        data.maintenanceMessage = null;
      } else if (typeof body.maintenanceMessage === "string") {
        const trimmed = body.maintenanceMessage.trim();
        data.maintenanceMessage = trimmed ? trimmed.slice(0, 2000) : null;
      } else {
        return NextResponse.json({ ok: false, error: "INVALID_MAINTENANCE_MESSAGE" }, { status: 400 });
      }
    }

    const row = await prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_GLOBAL_ID },
      create: {
        id: PLATFORM_SETTINGS_GLOBAL_ID,
        maintenanceMode: hasMode ? Boolean(body.maintenanceMode) : false,
        maintenanceMessage:
          hasMessage && data.maintenanceMessage !== undefined ? data.maintenanceMessage : null,
      },
      update: data,
      select: {
        maintenanceMode: true,
        maintenanceMessage: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        maintenanceMode: Boolean(row.maintenanceMode),
        maintenanceMessage:
          typeof row.maintenanceMessage === "string" && row.maintenanceMessage.trim()
            ? row.maintenanceMessage.trim()
            : null,
        updatedAt: row.updatedAt.toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    console.error("[api][admin][platform-settings][PATCH] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
