import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

type PrismaBookingDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
};

type PrismaConversationDelegate = {
  findMany: (args: unknown) => Promise<unknown>;
};

type PrismaClientLike = {
  booking: PrismaBookingDelegate;
  conversation: PrismaConversationDelegate;
};

const prismaAny = prisma as unknown as PrismaClientLike;

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
    void req;
    const { uid, sitterId, termsBlocked } = await resolveDbUserAndSitterId();
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

    if (termsBlocked) {
      return NextResponse.json({ ok: false, error: "TERMS_NOT_ACCEPTED", termsVersion: CURRENT_TERMS_VERSION }, { status: 403 });
    }

    const bookingsRaw = await prismaAny.booking.findMany({
      where: {
        sitterId,
        status: { in: ["PENDING_ACCEPTANCE", "PAID", "CONFIRMED", "CANCELLED", "REFUNDED", "REFUND_FAILED"] },
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

    const bookings = (Array.isArray(bookingsRaw) ? bookingsRaw : []) as unknown[];

    const bookingIds = bookings.map((b) => String((b as Record<string, unknown>)?.id ?? ""));
    const ownerIds = bookings
      .map((b) => {
        const user = (b as Record<string, unknown>)?.user as Record<string, unknown> | null;
        return String(user?.id ?? "");
      })
      .filter(Boolean);

    const [conversationPairsRaw, ownerPairsRaw] = await Promise.all([
      prismaAny.conversation.findMany({
        where: {
          sitterId,
          bookingId: { in: bookingIds },
        },
        select: { id: true, bookingId: true },
      }),
      prismaAny.conversation.findMany({
        where: {
          sitterId,
          ownerId: { in: ownerIds },
        },
        select: { id: true, ownerId: true },
      }),
    ]);

    const conversationPairs = (Array.isArray(conversationPairsRaw) ? conversationPairsRaw : []) as unknown[];
    const ownerPairs = (Array.isArray(ownerPairsRaw) ? ownerPairsRaw : []) as unknown[];

    const conversationByBookingId = new Map<string, string>();
    for (const c of conversationPairs) {
      const rec = c as Record<string, unknown>;
      const bId = typeof rec?.bookingId === "string" ? String(rec.bookingId) : "";
      const cId = typeof rec?.id === "string" ? String(rec.id) : "";
      if (bId && cId) conversationByBookingId.set(bId, cId);
    }

    const conversationByOwnerId = new Map<string, string>();
    for (const c of ownerPairs) {
      const rec = c as Record<string, unknown>;
      const oId = typeof rec?.ownerId === "string" ? String(rec.ownerId) : "";
      const cId = typeof rec?.id === "string" ? String(rec.id) : "";
      if (oId && cId && !conversationByOwnerId.has(oId)) conversationByOwnerId.set(oId, cId);
    }

    const items: BookingListItem[] = bookings.map((b) => {
      const rec = b as Record<string, unknown>;
      const userRec = (rec.user as Record<string, unknown> | null) ?? null;
      const ownerName = typeof userRec?.name === "string" && String(userRec.name).trim() ? String(userRec.name).trim() : "Client";
      const avatarUrl = typeof userRec?.image === "string" && String(userRec.image).trim() ? String(userRec.image).trim() : null;

      const createdAt = rec.createdAt;
      const updatedAt = rec.updatedAt;
      const archivedAt = rec.archivedAt;
      const startDate = rec.startDate;
      const endDate = rec.endDate;

      return {
        id: String(rec.id ?? ""),
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : new Date(String(createdAt ?? "")).toISOString(),
        updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : new Date(String(updatedAt ?? "")).toISOString(),
        archivedAt:
          archivedAt instanceof Date ? archivedAt.toISOString() : archivedAt ? new Date(String(archivedAt)).toISOString() : null,
        conversationId: conversationByBookingId.get(String(rec.id ?? "")) ?? conversationByOwnerId.get(String(userRec?.id ?? "")) ?? null,
        status: String(rec.status ?? ""),
        service: typeof rec.service === "string" ? String(rec.service) : null,
        startDate: startDate instanceof Date ? startDate.toISOString() : startDate ? new Date(String(startDate)).toISOString() : null,
        endDate: endDate instanceof Date ? endDate.toISOString() : endDate ? new Date(String(endDate)).toISOString() : null,
        message: typeof rec.message === "string" ? String(rec.message) : null,
        amount: typeof rec.amount === "number" ? rec.amount : Number(rec.amount ?? 0),
        currency: typeof rec.currency === "string" ? String(rec.currency) : "chf",
        owner: { id: String(userRec?.id ?? ""), name: ownerName, avatarUrl },
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
