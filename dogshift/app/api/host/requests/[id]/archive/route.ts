import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RoleJwt = { uid?: string; sub?: string; sitterId?: string };

function tokenUserId(token: RoleJwt | null) {
  const uid = typeof token?.uid === "string" ? token.uid : null;
  const sub = typeof token?.sub === "string" ? token.sub : null;
  return uid ?? sub;
}

async function resolveSitterId(uid: string, token: RoleJwt | null) {
  const fromToken = typeof token?.sitterId === "string" && token.sitterId.trim() ? token.sitterId.trim() : null;
  if (fromToken) return fromToken;
  const user = await (prisma as any).user.findUnique({ where: { id: uid }, select: { sitterId: true } });
  const fromDb = typeof user?.sitterId === "string" && user.sitterId.trim() ? user.sitterId.trim() : null;
  return fromDb;
}

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = (await ctx.params) as { id?: string };
    const bookingId = typeof params?.id === "string" ? params.id : "";
    if (!bookingId) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as RoleJwt | null;
    const uid = tokenUserId(token);
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][requests][archive][POST] UNAUTHORIZED", { hasToken: Boolean(token) });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const sitterId = await resolveSitterId(uid, token);
    if (!sitterId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][requests][archive][POST] UNAUTHORIZED_NO_SITTER", { uid });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: { id: true, sitterId: true, status: true, archivedAt: true },
    });

    if (!booking || String(booking.sitterId) !== sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const status = String(booking.status);
    if (status === "CONFIRMED" || status === "PAID" || status === "PENDING_ACCEPTANCE") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const now = new Date();

    const updated = await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { archivedAt: now },
      select: { id: true, archivedAt: true },
    });

    return NextResponse.json(
      { ok: true, id: String(updated.id), archivedAt: updated.archivedAt instanceof Date ? updated.archivedAt.toISOString() : String(updated.archivedAt) },
      { status: 200 }
    );
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    console.error("[api][host][requests][archive][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
