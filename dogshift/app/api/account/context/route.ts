import { NextResponse } from "next/server";

import { getUserContexts } from "@/lib/userContexts";
import { isActivatedStatus } from "@/lib/sitterContract";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const contexts = await getUserContexts();

    const activated =
      contexts.sitterLifecycleStatus != null &&
      isActivatedStatus(contexts.sitterLifecycleStatus);
    const monEspaceHref = activated ? "/host" : "/account";

    const dbUser = await prisma.user.findUnique({
      where: { id: contexts.dbUserId },
      select: { role: true, sitterId: true },
    });

    console.info("[role-resolution][account/context]", {
      dbUserId: contexts.dbUserId,
      email: contexts.primaryEmail,
      dbRole: dbUser?.role ?? null,
      dbSitterId: dbUser?.sitterId ?? null,
      hasSitterProfile: contexts.hasSitterProfile,
      sitterLifecycleStatus: contexts.sitterLifecycleStatus,
      activated,
      monEspaceHref,
    });

    return NextResponse.json(
      {
        ok: true,
        hasSitterProfile: contexts.hasSitterProfile,
        hasOwnerContext: contexts.hasOwnerContext,
        sitterLifecycleStatus: contexts.sitterLifecycleStatus,
        dbRole: dbUser?.role ?? null,
        monEspaceHref,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED", monEspaceHref: "/account" }, { status: 401 });
  }
}
