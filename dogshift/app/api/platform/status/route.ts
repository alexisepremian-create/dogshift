import { NextResponse } from "next/server";

import { getPlatformSettingsForPublic } from "@/lib/platform/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { maintenanceMode, maintenanceMessage, displayMessage } = await getPlatformSettingsForPublic();
    return NextResponse.json(
      {
        ok: true,
        maintenanceMode,
        maintenanceMessage,
        message: displayMessage,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[api][platform][status] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
