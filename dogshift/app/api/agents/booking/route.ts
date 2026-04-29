import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/agents/booking
 * Agent Booking : créer, modifier, annuler une réservation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, bookingId, sitterId, userId, startAt, endAt, serviceType, message } = body;

    const start = Date.now();
    let result;

    switch (action) {
      case "create_booking": {
        if (!sitterId || !userId || !startAt || !endAt || !serviceType) {
          return NextResponse.json({ error: "Missing required fields: sitterId, userId, startAt, endAt, serviceType" }, { status: 400 });
        }

        // Vérifier que le sitter existe et est publié
        const sitter = await prisma.sitterProfile.findUnique({
          where: { sitterId },
          select: { id: true, published: true },
        });

        if (!sitter) {
          return NextResponse.json({ error: "Sitter not found" }, { status: 404 });
        }

        if (!sitter.published) {
          return NextResponse.json({ error: "Sitter is not available" }, { status: 400 });
        }

        // Calculer le montant (à améliorer avec les vrais tarifs)
        const diffMs = new Date(endAt).getTime() - new Date(startAt).getTime();
        const diffHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        const amount = diffHours * 2500; // 25 CHF / heure en centimes
        const platformFee = Math.round(amount * 0.1); // 10% commission

        const booking = await prisma.booking.create({
          data: {
            sitterId,
            userId,
            serviceType,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            message: message || null,
            amount,
            platformFeeAmount: platformFee,
            status: "PENDING_PAYMENT",
          },
        });

        result = { success: true, bookingId: booking.id, amount, platformFee };
        break;
      }

      case "cancel_booking": {
        if (!bookingId) {
          return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
        }

        const booking = await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "CANCELLED",
            canceledAt: new Date(),
          },
        });

        result = { success: true, bookingId, status: booking.status };
        break;
      }

      case "get_booking": {
        if (!bookingId) {
          return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            user: { select: { id: true, name: true, email: true } },
            sitter: { select: { id: true, name: true } },
          },
        });

        if (!booking) {
          return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }

        result = booking;
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Logger l'action
    const durationMs = Date.now() - start;
    const logTarget = (result as any).bookingId || bookingId;
    await prisma.agentLog.create({
      data: {
        agentName: "booking_agent",
        actionType: `booking_${action}`,
        summary: `Booking ${action} → OK`,
        details: { action, bookingId, sitterId, userId },
        targetId: logTarget,
        durationMs,
        status: "success",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[agents/booking] Error:", error);
    await prisma.agentLog.create({
      data: {
        agentName: "booking_agent",
        actionType: "booking_error",
        summary: `Erreur: ${(error as Error).message}`,
        details: { error: String(error) },
        status: "error",
      },
    }).catch(() => {});
    return NextResponse.json({ error: "Failed to process booking" }, { status: 500 });
  }
}