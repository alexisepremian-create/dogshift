import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import { logAdminAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ACTIVE_BOOKING_STATUSES = ["PENDING_PAYMENT", "PENDING_ACCEPTANCE", "PAID", "CONFIRMED"];

/**
 * DELETE /api/account/delete
 *
 * RGPD / nLPD — Droit à l'effacement.
 * Supprime le compte Clerk + les données personnelles Prisma de l'utilisateur connecté.
 *
 * Règles :
 * - Bloqué si l'utilisateur a des réservations actives en cours (propriétaire)
 * - Bloqué si l'utilisateur est un sitter avec des réservations (les archives financières
 *   doivent être conservées) — ses données perso sont anonymisées à la place
 * - Pour les utilisateurs sans contrainte : suppression complète en cascade (Prisma onDelete: Cascade)
 */
export async function DELETE(req: NextRequest) {
  try {
    void req;

    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
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

    const uid = ensured.id;

    // Check for active bookings as owner
    const activeOwnerBookings = await prisma.booking.count({
      where: {
        userId: uid,
        status: { in: ACTIVE_BOOKING_STATUSES as any },
      },
    });

    if (activeOwnerBookings > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "ACTIVE_BOOKINGS",
          message:
            "Vous avez des réservations en cours. Veuillez attendre leur finalisation ou les annuler avant de supprimer votre compte.",
        },
        { status: 409 }
      );
    }

    // Check if user is a sitter with any bookings (financial records must be preserved)
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { sitterId: true },
    });

    const sitterId = typeof (user as any)?.sitterId === "string" ? (user as any).sitterId : null;
    const hasSitterBookings = sitterId
      ? (await prisma.booking.count({ where: { sitterId } })) > 0
      : false;

    if (hasSitterBookings) {
      // Anonymize personal data instead of hard delete (financial records must be kept)
      await prisma.user.update({
        where: { id: uid },
        data: {
          email: `deleted-${uid}@deleted.invalid`,
          name: "[Compte supprimé]",
          phone: null,
          image: null,
          hostProfileJson: null,
          clerkUserId: null,
        } as any,
      });

      // Anonymize sitter profile display data
      await prisma.sitterProfile.updateMany({
        where: { userId: uid },
        data: {
          displayName: null,
          bio: null,
          avatarUrl: null,
          published: false,
          city: null,
          postalCode: null,
          lat: null,
          lng: null,
        },
      });

      // Delete Clerk account
      const client = await clerkClient();
      await client.users.deleteUser(clerkUserId);

      logAdminAudit({
        action: "account.delete",
        adminUserId: clerkUserId,
        targetId: uid,
        targetType: "USER",
        detail: { method: "anonymize", reason: "sitter_has_bookings" },
      });

      return NextResponse.json(
        { ok: true, method: "anonymized" },
        { status: 200 }
      );
    }

    // Hard delete: Prisma onDelete Cascade handles all related data
    await prisma.user.delete({ where: { id: uid } });

    // Delete Clerk account
    const client = await clerkClient();
    await client.users.deleteUser(clerkUserId);

    logAdminAudit({
      action: "account.delete",
      adminUserId: clerkUserId,
      targetId: uid,
      targetType: "USER",
      detail: { method: "hard_delete" },
    });

    return NextResponse.json({ ok: true, method: "deleted" }, { status: 200 });
  } catch (err) {
    console.error("[api][account][delete][DELETE] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
