import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const amendments = await (prisma as any).contractAmendment.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        acceptances: {
          orderBy: { acceptedAt: "desc" },
          select: {
            acceptedAt: true,
            amendmentVersion: true,
            sitterProfile: {
              select: {
                sitterId: true,
                displayName: true,
                user: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const sitters = await prisma.user.findMany({
      where: { sitterId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        sitterProfile: {
          select: {
            id: true,
            sitterId: true,
            displayName: true,
            contractVersion: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, amendments, sitters });
  } catch (err) {
    console.error("[api][admin][contract-amendments][GET] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { title?: string; content?: string; version?: string; isActive?: boolean } | null;
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const version = typeof body?.version === "string" ? body.version.trim().slice(0, 40) : "";
    const isActive = body?.isActive === true;

    if (!title || !content || !version) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    if (isActive) {
      await (prisma as any).contractAmendment.updateMany({ where: { isActive: true }, data: { isActive: false, activatedAt: null } });
    }

    const amendment = await (prisma as any).contractAmendment.create({
      data: {
        title,
        content,
        version,
        isActive,
        activatedAt: isActive ? new Date() : null,
      },
    });

    return NextResponse.json({ ok: true, amendment });
  } catch (err) {
    console.error("[api][admin][contract-amendments][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
