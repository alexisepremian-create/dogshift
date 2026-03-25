import { NextResponse } from "next/server";

import {
  DEFAULT_MAINTENANCE_PUBLIC_MESSAGE,
  PLATFORM_SETTINGS_GLOBAL_ID,
} from "@/lib/platform/maintenanceConstants";
import { prisma } from "@/lib/prisma";

export { DEFAULT_MAINTENANCE_PUBLIC_MESSAGE, PLATFORM_SETTINGS_GLOBAL_ID };

export async function getPlatformSettingsForPublic() {
  const row = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_GLOBAL_ID },
  });
  const maintenanceMode = Boolean(row?.maintenanceMode);
  const custom =
    typeof row?.maintenanceMessage === "string" && row.maintenanceMessage.trim()
      ? row.maintenanceMessage.trim()
      : null;
  return {
    maintenanceMode,
    maintenanceMessage: custom,
    displayMessage: maintenanceMode ? custom ?? DEFAULT_MAINTENANCE_PUBLIC_MESSAGE : null,
  };
}

/** 503 JSON when platform is in maintenance (commerce/booking blocked). Otherwise null. */
export async function commerceBlockedResponse(): Promise<NextResponse | null> {
  const row = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_GLOBAL_ID },
  });
  if (!row?.maintenanceMode) return null;
  const custom =
    typeof row.maintenanceMessage === "string" && row.maintenanceMessage.trim()
      ? row.maintenanceMessage.trim()
      : null;
  const message = custom ?? DEFAULT_MAINTENANCE_PUBLIC_MESSAGE;
  return NextResponse.json(
    { ok: false, error: "MAINTENANCE", message },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
