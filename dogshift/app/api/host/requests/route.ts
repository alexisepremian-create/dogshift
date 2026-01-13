import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type BookingListItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  conversationId: string | null;
  status: string;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  message: string | null;
  amount: number;
  currency: string;
  owner: { id: string; name: string; avatarUrl: string | null };
};

async function resolveDbUserAndSitterId() {
  const { userId } = await auth();
  if (!userId) return { uid: null as string | null, sitterId: null as string | null };

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!primaryEmail) return { uid: null as string | null, sitterId: null as string | null };

  const dbUser = await prisma.user.findUnique({ where: { email: primaryEmail }, select: { id: true, sitterId: true } });
  if (!dbUser) return { uid: null as string | null, sitterId: null as string | null };

  const sitterProfile = await prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { sitterId: true } });
  const sitterId = typeof sitterProfile?.sitterId === "string" && sitterProfile.sitterId.trim() ? sitterProfile.sitterId.trim() : null;

  return { uid: dbUser.id, sitterId };
}

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

function isSchemaMismatchError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("no such column") ||
    msg.includes("Unknown column") ||
    msg.includes("P2022") ||
    msg.includes("archivedAt")
  );
}

export async function GET(req: NextRequest) {
  try {
    const { uid, sitterId } = await resolveDbUserAndSitterId();
    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][requests][GET] UNAUTHORIZED", { hasUser: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!sitterId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][requests][GET] UNAUTHORIZED_NO_SITTER", { uid });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const bookings = await (prisma as any).booking.findMany({
      where: {
        sitterId,
        status: { in: ["PENDING_PAYMENT", "PENDING_ACCEPTANCE", "PAID", "CONFIRMED", "PAYMENT_FAILED", "CANCELLED", "DRAFT"] },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true,
        status: true,
        service: true,
        startDate: true,
        endDate: true,
        message: true,
        amount: true,
        currency: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    const bookingIds = bookings.map((b: any) => String(b.id));
    const ownerIds = bookings.map((b: any) => String(b?.user?.id)).filter(Boolean);

    const [conversationPairs, ownerPairs] = await Promise.all([
      (prisma as any).conversation.findMany({
        where: {
          sitterId,
          bookingId: { in: bookingIds },
        },
        select: { id: true, bookingId: true },
      }),
      (prisma as any).conversation.findMany({
        where: {
          sitterId,
          ownerId: { in: ownerIds },
        },
        select: { id: true, ownerId: true },
      }),
    ]);

    const conversationByBookingId = new Map<string, string>();
    for (const c of conversationPairs as any[]) {
      const bId = typeof c?.bookingId === "string" ? c.bookingId : "";
      const cId = typeof c?.id === "string" ? c.id : "";
      if (bId && cId) conversationByBookingId.set(bId, cId);
    }

    const conversationByOwnerId = new Map<string, string>();
    for (const c of ownerPairs as any[]) {
      const oId = typeof c?.ownerId === "string" ? c.ownerId : "";
      const cId = typeof c?.id === "string" ? c.id : "";
      if (oId && cId && !conversationByOwnerId.has(oId)) conversationByOwnerId.set(oId, cId);
    }

    const items: BookingListItem[] = bookings.map((b: any) => {
      const ownerName = typeof b?.user?.name === "string" && b.user.name.trim() ? b.user.name.trim() : "Client";
      const avatarUrl = typeof b?.user?.image === "string" && b.user.image.trim() ? b.user.image.trim() : null;

      return {
        id: String(b.id),
        createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : new Date(b.createdAt).toISOString(),
        updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : new Date(b.updatedAt).toISOString(),
        archivedAt: b.archivedAt instanceof Date ? b.archivedAt.toISOString() : b.archivedAt ? new Date(b.archivedAt).toISOString() : null,
        conversationId: conversationByBookingId.get(String(b.id)) ?? conversationByOwnerId.get(String(b.user.id)) ?? null,
        status: String(b.status),
        service: typeof b.service === "string" ? b.service : null,
        startDate: b.startDate instanceof Date ? b.startDate.toISOString() : b.startDate ? new Date(b.startDate).toISOString() : null,
        endDate: b.endDate instanceof Date ? b.endDate.toISOString() : b.endDate ? new Date(b.endDate).toISOString() : null,
        message: typeof b.message === "string" ? b.message : null,
        amount: typeof b.amount === "number" ? b.amount : Number(b.amount ?? 0),
        currency: typeof b.currency === "string" ? b.currency : "chf",
        owner: { id: String(b.user.id), name: ownerName, avatarUrl },
      };
    });

    return NextResponse.json({ ok: true, bookings: items }, { status: 200 });
  } catch (err) {
    if (isMigrationMissingError(err)) {
      return NextResponse.json(
        { ok: false, error: "MIGRATION_MISSING", message: "Database schema missing. Run: prisma migrate dev" },
        { status: 500 }
      );
    }

    if (isSchemaMismatchError(err)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][host][requests][GET] DB_MIGRATION_REQUIRED", err);
      }
      return NextResponse.json(
        {
          ok: false,
          error: "DB_MIGRATION_REQUIRED",
          message:
            process.env.NODE_ENV !== "production"
              ? err instanceof Error
                ? err.message
                : String(err)
              : undefined,
        },
        { status: 500 }
      );
    }

    console.error("[api][host][requests][GET] error", err);
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message:
          process.env.NODE_ENV !== "production"
            ? err instanceof Error
              ? err.message
              : String(err)
            : undefined,
      },
      { status: 500 }
    );
  }
}
