import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type AdminNoteTargetType = "USER" | "BOOKING" | "PILOT_SITTER_APPLICATION" | "SITTER_PROFILE";

const VALID_TARGETS = new Set<AdminNoteTargetType>(["USER", "BOOKING", "PILOT_SITTER_APPLICATION", "SITTER_PROFILE"]);

function isValidTargetType(value: unknown): value is AdminNoteTargetType {
  return typeof value === "string" && VALID_TARGETS.has(value as AdminNoteTargetType);
}

function isAdminNoteTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("AdminNote") || message.includes("does not exist") || message.includes("P2021");
}

export async function GET(req: NextRequest) {
  try {
    const admin = await getRequestAdminAccess(req);
    if (!admin.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const targetType = req.nextUrl.searchParams.get("targetType");
    const targetId = req.nextUrl.searchParams.get("targetId")?.trim() ?? "";

    if (!isValidTargetType(targetType) || !targetId) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    const db = prisma as unknown as {
      adminNote: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            targetType: AdminNoteTargetType;
            targetId: string;
            body: string;
            authorClerkUserId: string | null;
            authorUserId: string | null;
            createdAt: Date;
            updatedAt: Date;
          }>
        >;
      };
    };

    const notes = await db.adminNote.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        ok: true,
        notes: notes.map((note) => ({
          ...note,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api][admin][notes][GET] error", error);
    if (isAdminNoteTableError(error)) {
      return NextResponse.json({ ok: false, error: "ADMIN_NOTES_TABLE_NOT_READY" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getRequestAdminAccess(req);
    if (!admin.isAdmin) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      targetType?: unknown;
      targetId?: unknown;
      body?: unknown;
    } | null;

    const targetType = body?.targetType;
    const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
    const noteBody = typeof body?.body === "string" ? body.body.trim() : "";

    if (!isValidTargetType(targetType) || !targetId || !noteBody) {
      return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
    }

    if (noteBody.length > 4000) {
      return NextResponse.json({ ok: false, error: "NOTE_TOO_LONG" }, { status: 400 });
    }

    const { userId: clerkUserId } = await auth();

    const db = prisma as unknown as {
      user: {
        findUnique: (args: unknown) => Promise<{ id: string } | null>;
      };
      adminNote: {
        create: (args: unknown) => Promise<{
          id: string;
          targetType: AdminNoteTargetType;
          targetId: string;
          body: string;
          authorClerkUserId: string | null;
          authorUserId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>;
      };
    };

    const authorUser = clerkUserId
      ? await db.user.findUnique({ where: { clerkUserId }, select: { id: true } })
      : null;

    const created = await db.adminNote.create({
      data: {
        targetType,
        targetId,
        body: noteBody,
        authorClerkUserId: clerkUserId ?? null,
        authorUserId: authorUser?.id ?? null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        note: {
          ...created,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api][admin][notes][POST] error", error);
    if (isAdminNoteTableError(error)) {
      return NextResponse.json({ ok: false, error: "ADMIN_NOTES_TABLE_NOT_READY" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
