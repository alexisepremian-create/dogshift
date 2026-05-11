/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthedDbUser } from "@/lib/auth/getAuthedDbUser";
// TODO(PR2): clerkClient() removed — replace its callers with prisma/bcrypt direct calls.

import { prisma } from "@/lib/prisma";
import { logAdminAudit } from "@/lib/audit";
import { ownerBookingBlocksAccountDeletion } from "@/lib/bookings/bookingServiceEnd";

export const runtime = "nodejs";

const ACTIVE_BOOKING_STATUSES = ["PENDING_PAYMENT", "PENDING_ACCEPTANCE", "PAID", "CONFIRMED"];

/**
 * DELETE /api/account/delete
 *
 * RGPD / nLPD — Droit à l'effacement.
 * Supprime le compte Clerk + les données personnelles Prisma de l'utilisateur connecté.
 *
 * Règles :
 * - Bloqué si l'utilisateur a des réservations actives (paiement / validation) ou une
 *   prestation payée / confirmée dont la fin (jour civil Zurich pour Pension–Garde) n'est pas encore passée
 * - Bloqué si l'utilisateur est un sitter avec des réservations (les archives financières
 *   doivent être conservées) — ses données perso sont anonymisées à la place
 * - Pour les utilisateurs sans contrainte : suppression complète en cascade (Prisma onDelete: Cascade)
 */
export async function DELETE(req: NextRequest) {
  try {
    void req;

    const __authed = await getAuthedDbUser();
    const clerkUserId = __authed?.id ?? null;
    if (!clerkUserId) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // currentUser() removed — use __authed.email / __authed.name
    const primaryEmail = __authed?.email ?? "";
    if (!primaryEmail) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    if (!__authed) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const uid = __authed.id;

    // Owner-side gate: pending payment/acceptance always block; PAID/CONFIRMED only until service end.
    const ownerGateBookings = await prisma.booking.findMany({
      where: {
        userId: uid,
        archivedAt: null,
        status: { in: ACTIVE_BOOKING_STATUSES as any },
      },
      select: { id: true, status: true, service: true, endDate: true, endAt: true, archivedAt: true },
    });
    const now = new Date();
    const activeOwnerBookings = ownerGateBookings.filter((b) => ownerBookingBlocksAccountDeletion(b, now)).length;

    // Auto-archive unpaid bookings (abandoned checkouts) so they don't block cascade delete
    const unpaidBookingIds = ownerGateBookings
      .filter((b) => b.status === "PENDING_PAYMENT" || b.status === "DRAFT")
      .map((b) => b.id);
    if (unpaidBookingIds.length > 0) {
      await prisma.booking.updateMany({
        where: { id: { in: unpaidBookingIds } },
        data: { archivedAt: now, status: "CANCELLED" as any },
      });
    }

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

      // Auth.js sessions live in the Prisma Session table — onDelete Cascade
      // wipes them when we delete the User. For anonymize-only flows the user
      // row stays, so we explicitly purge sessions to log them out.
      await prisma.session.deleteMany({ where: { userId: uid } });

      logAdminAudit({
        action: "account.delete",
        adminUserId: uid,
        targetId: uid,
        targetType: "USER",
        detail: { method: "anonymize", reason: "sitter_has_bookings" },
      });

      return NextResponse.json(
        { ok: true, method: "anonymized" },
        { status: 200 }
      );
    }

    // Hard delete: Prisma onDelete Cascade handles all related data,
    // including Account + Session rows owned by Auth.js.
    await prisma.user.delete({ where: { id: uid } });

    logAdminAudit({
      action: "account.delete",
      adminUserId: uid,
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
