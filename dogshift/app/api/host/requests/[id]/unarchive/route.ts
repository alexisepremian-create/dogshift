import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

type PrismaBookingDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
};

type PrismaClientLike = {
  booking: PrismaBookingDelegate;
};

const prismaAny = prisma as unknown as PrismaClientLike;

export const runtime = "nodejs";

async function resolveDbUserAndSitterId() {
  const { userId } = await auth();
  if (!userId) return { uid: null as string | null, sitterId: null as string | null };

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) return { uid: null as string | null, sitterId: null as string | null };

  const dbUser = await prisma.user.findUnique({ where: { email: primaryEmail }, select: { id: true, sitterId: true } });
  if (!dbUser) return { uid: null as string | null, sitterId: null as string | null };

  const sitterProfile = await prisma.sitterProfile.findUnique({
    where: { userId: dbUser.id },
    select: { sitterId: true, termsAcceptedAt: true, termsVersion: true },
  });
  const sitterId = typeof sitterProfile?.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : null;

  const termsOk = Boolean(sitterProfile?.termsAcceptedAt) && sitterProfile?.termsVersion === CURRENT_TERMS_VERSION;
  if (!termsOk) return { uid: dbUser.id, sitterId, termsBlocked: true as const };

  return { uid: dbUser.id, sitterId, termsBlocked: false as const };
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

    const { uid, sitterId, termsBlocked } = await resolveDbUserAndSitterId();
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][requests][unarchive][POST] UNAUTHORIZED", { hasUser: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!sitterId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][requests][unarchive][POST] UNAUTHORIZED_NO_SITTER", { uid });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (termsBlocked) {
      return NextResponse.json({ ok: false, error: "TERMS_NOT_ACCEPTED", termsVersion: CURRENT_TERMS_VERSION }, { status: 403 });
    }

    const bookingRaw = await prismaAny.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, sitterId: true },
    });

    const booking = (bookingRaw as Record<string, unknown> | null) ?? null;

    if (!booking || String(booking.sitterId ?? "") !== sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const updatedRaw = await prismaAny.booking.update({
      where: { id: bookingId },
      data: { archivedAt: null },
      select: { id: true },
    });

    const updated = (updatedRaw as Record<string, unknown> | null) ?? null;

    return NextResponse.json({ ok: true, id: String(updated?.id ?? "") }, { status: 200 });
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }
    console.error("[api][host][requests][unarchive][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
