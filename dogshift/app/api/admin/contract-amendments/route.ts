import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { contractAmendmentStatusColumnExists } from "@/lib/contractAmendments/statusSupport";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function errorPayload(err: unknown) {
  const e = err as {
    name?: string;
    code?: string;
    message?: string;
    stack?: string;
    meta?: unknown;
  };
  return {
    name: e?.name ?? null,
    code: e?.code ?? null,
    message: e?.message ?? null,
    meta: e?.meta ?? null,
    stack: e?.stack ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const access = await getRequestAdminAccess(req);
    if (!access.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const supportsStatus = await contractAmendmentStatusColumnExists();
    console.info("[contract-amendment][status-preflight]", { route: "admin/contract-amendments[GET]", supportsStatus });
    let amendments: any[] = [];
    if (supportsStatus) {
      amendments = await (prisma as any).contractAmendment.findMany({
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
    } else {
      const legacyAmendments = await (prisma as any).contractAmendment.findMany({
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          content: true,
          version: true,
          isActive: true,
          createdAt: true,
          activatedAt: true,
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
      amendments = legacyAmendments.map((a: any) => ({
        ...a,
        status: a?.isActive ? "ACTIVE" : "INACTIVE",
      }));
      console.warn("[api][admin][contract-amendments][GET] legacy mode (status column missing)");
    }

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
    const detail = errorPayload(err);
    console.error("[api][admin][contract-amendments][GET] error", detail);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: detail.message ?? "Unknown server error",
        code: detail.code ?? null,
      },
      { status: 500 },
    );
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

    const supportsStatus = await contractAmendmentStatusColumnExists();
    console.info("[contract-amendment][status-preflight]", { route: "admin/contract-amendments[POST]", supportsStatus, isActive });
    let amendment: any;
    if (supportsStatus) {
      if (isActive) {
        await (prisma as any).contractAmendment.updateMany({
          where: { status: "ACTIVE" },
          data: { isActive: false, status: "INACTIVE", activatedAt: null },
        });
      }
      amendment = await (prisma as any).contractAmendment.create({
        data: {
          title,
          content,
          version,
          status: isActive ? "ACTIVE" : "INACTIVE",
          isActive,
          activatedAt: isActive ? new Date() : null,
        },
      });
    } else {
      if (isActive) {
        await (prisma as any).contractAmendment.updateMany({
          where: { isActive: true },
          data: { isActive: false, activatedAt: null },
        });
      }
      amendment = await (prisma as any).contractAmendment.create({
        data: {
          title,
          content,
          version,
          isActive,
          activatedAt: isActive ? new Date() : null,
        },
      });
      amendment = { ...amendment, status: isActive ? "ACTIVE" : "INACTIVE" };
      console.warn("[api][admin][contract-amendments][POST] legacy mode (status column missing)");
    }

    return NextResponse.json({ ok: true, amendment });
  } catch (err) {
    const detail = errorPayload(err);
    console.error("[api][admin][contract-amendments][POST] error", detail);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: detail.message ?? "Unknown server error",
        code: detail.code ?? null,
      },
      { status: 500 },
    );
  }
}
