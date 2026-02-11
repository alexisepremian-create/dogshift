import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function requireAdmin(req: NextRequest) {
  const expected = (process.env.HOST_ADMIN_CODE ?? "").trim();
  const supplied = req.headers.get("x-admin-code")?.trim() ?? "";
  if (!expected || !supplied || supplied !== expected) {
    return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  try {
    if (!requireAdmin(req)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const { userId } = await auth();

    const db = prisma as unknown as {
      sitterProfile: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            sitterId: string;
            displayName?: string | null;
            city?: string | null;
            postalCode?: string | null;
            verificationStatus?: string | null;
            verificationSubmittedAt?: Date | null;
            idDocumentUrl?: string | null;
            selfieUrl?: string | null;
            user?: { email?: string | null; name?: string | null } | null;
          }>
        >;
      };
    };

    const pending = await db.sitterProfile.findMany({
      where: { verificationStatus: "pending" },
      orderBy: { verificationSubmittedAt: "asc" },
      select: {
        id: true,
        sitterId: true,
        displayName: true,
        city: true,
        postalCode: true,
        verificationStatus: true,
        verificationSubmittedAt: true,
        idDocumentUrl: true,
        selfieUrl: true,
        user: { select: { email: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        admin: {
          clerkUserId: userId ?? null,
        },
        pending: pending.map((p) => ({
          sitterProfileId: p.id,
          sitterId: p.sitterId,
          name: (p.displayName ?? p.user?.name ?? "").trim() || null,
          email: (p.user?.email ?? "").trim() || null,
          city: p.city ?? null,
          postalCode: p.postalCode ?? null,
          submittedAt: p.verificationSubmittedAt instanceof Date ? p.verificationSubmittedAt.toISOString() : null,
          idDocumentKey: typeof p.idDocumentUrl === "string" ? p.idDocumentUrl : null,
          selfieKey: typeof p.selfieUrl === "string" ? p.selfieUrl : null,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[api][admin][verifications][pending] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
