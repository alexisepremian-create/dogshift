import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function resolveDbUserAndSitterId() {
  const { userId } = await auth();
  if (!userId) return { uid: null as string | null, sitterId: null as string | null };

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) return { uid: null as string | null, sitterId: null as string | null };

  const dbUser = await prisma.user.findUnique({ where: { email: primaryEmail }, select: { id: true, sitterId: true } });
  if (!dbUser) return { uid: null as string | null, sitterId: null as string | null };

  const sitterProfile = await prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { sitterId: true } });
  const sitterId =
    (typeof sitterProfile?.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : null) ??
    (typeof dbUser.sitterId === "string" && dbUser.sitterId.trim() ? dbUser.sitterId.trim() : null);

  return { uid: dbUser.id, sitterId };
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

    const { uid, sitterId } = await resolveDbUserAndSitterId();
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

    const booking = await (prisma as any).booking.findUnique({
      where: { id: bookingId },
      select: { id: true, sitterId: true },
    });

    if (!booking || String(booking.sitterId) !== sitterId) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const updated = await (prisma as any).booking.update({
      where: { id: bookingId },
      data: { archivedAt: null },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: String(updated.id) }, { status: 200 });
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
