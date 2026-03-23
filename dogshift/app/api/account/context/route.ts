import { NextResponse } from "next/server";

import { getUserContexts } from "@/lib/userContexts";
import { isActivatedStatus } from "@/lib/sitterContract";

export const runtime = "nodejs";

export async function GET() {
  try {
    const contexts = await getUserContexts();

    return NextResponse.json(
      {
        ok: true,
        hasSitterProfile: contexts.hasSitterProfile,
        hasOwnerContext: contexts.hasOwnerContext,
        sitterLifecycleStatus: contexts.sitterLifecycleStatus,
        monEspaceHref: contexts.sitterLifecycleStatus && isActivatedStatus(contexts.sitterLifecycleStatus) ? "/host" : "/account",
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED", monEspaceHref: "/account" }, { status: 401 });
  }
}
