import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export const runtime = "nodejs";

function isMigrationMissingError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("no such table") || msg.includes("does not exist") || msg.includes("P2021");
}

function isPrismaInconsistentResultError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("inconsistent query result") || msg.includes("P2025");
}

type AccountBookingListItem = {
  id: string;
  createdAt: string;
  archivedAt: string | null;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  amount: number;
  currency: string;
  platformFeeAmount: number;
  sitter: {
    sitterId: string;
    name: string;
    avatarUrl: string | null;
  };
};

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][GET] UNAUTHORIZED", { hasUserId: false });
      }
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ensured = await ensureDbUserByClerkUserId({
      clerkUserId,
      email: primaryEmail,
      name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
    });
    if (!ensured) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const userId = ensured.id;

    const bookings = await (prisma as any).booking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        archivedAt: true,
        service: true,
        startDate: true,
        endDate: true,
        status: true,
        amount: true,
        currency: true,
        platformFeeAmount: true,
        sitterId: true,
      },
    });

    if (!Array.isArray(bookings) || bookings.length === 0) {
      return NextResponse.json({ ok: true, bookings: [] }, { status: 200 });
    }

    const sitterKeys = Array.from(
      new Set(
        bookings
          .map((b: any) => (typeof b?.sitterId === "string" ? b.sitterId : ""))
          .map((s: string) => s.trim())
          .filter(Boolean)
      )
    );

    const sitters = await (prisma as any).user.findMany({
      where: {
        OR: [{ sitterId: { in: sitterKeys } }, { id: { in: sitterKeys } }],
      },
      select: {
        id: true,
        sitterId: true,
        name: true,
        image: true,
        sitterProfile: { select: { displayName: true, avatarUrl: true } },
      },
    });

    const sitterByKey = new Map<string, any>();
    for (const u of Array.isArray(sitters) ? sitters : []) {
      if (typeof u?.sitterId === "string" && u.sitterId.trim()) sitterByKey.set(u.sitterId.trim(), u);
      if (typeof u?.id === "string" && u.id.trim()) sitterByKey.set(u.id.trim(), u);
    }

    const items: AccountBookingListItem[] = bookings.map((b: any) => {
      const sitterKey = typeof b?.sitterId === "string" ? b.sitterId : "";
      const sitter = sitterByKey.get(sitterKey) ?? null;

      const displayName =
        (typeof sitter?.sitterProfile?.displayName === "string" && sitter.sitterProfile.displayName.trim()
          ? sitter.sitterProfile.displayName.trim()
          : null) ??
        (typeof sitter?.name === "string" && sitter.name.trim() ? sitter.name.trim() : "Dogsitter");

      const avatarUrlRaw =
        (typeof sitter?.sitterProfile?.avatarUrl === "string" && sitter.sitterProfile.avatarUrl.trim()
          ? sitter.sitterProfile.avatarUrl.trim()
          : null) ??
        (typeof sitter?.image === "string" && sitter.image.trim() ? sitter.image.trim() : null);

      return {
        id: String(b.id),
        createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : new Date(b.createdAt).toISOString(),
        archivedAt: b.archivedAt instanceof Date ? b.archivedAt.toISOString() : b.archivedAt ? new Date(b.archivedAt).toISOString() : null,
        service: typeof b.service === "string" ? b.service : null,
        startDate: b.startDate instanceof Date ? b.startDate.toISOString() : b.startDate ? new Date(b.startDate).toISOString() : null,
        endDate: b.endDate instanceof Date ? b.endDate.toISOString() : b.endDate ? new Date(b.endDate).toISOString() : null,
        status: String(b.status ?? "PENDING_PAYMENT"),
        amount: typeof b.amount === "number" ? b.amount : 0,
        currency: typeof b.currency === "string" ? b.currency : "chf",
        platformFeeAmount: typeof b.platformFeeAmount === "number" ? b.platformFeeAmount : 0,
        sitter: {
          sitterId: String((typeof sitter?.sitterId === "string" && sitter.sitterId) || sitterKey),
          name: displayName,
          avatarUrl: avatarUrlRaw,
        },
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
    if (isPrismaInconsistentResultError(err)) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[api][account][bookings][GET] INCONSISTENT_RESULT", { err });
      }
      return NextResponse.json({ ok: true, bookings: [] }, { status: 200 });
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[api][account][bookings][GET] error", err);
    }
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
