import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/agents/availability
 * Agent Disponibilité : vérifier les créneaux dispo d'un sitter
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sitterId, date, serviceType } = body;

    if (!sitterId || !date) {
      return NextResponse.json({ error: "Missing required fields: sitterId, date" }, { status: 400 });
    }

    const start = Date.now();
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const dateKey = dateObj.toISOString().split("T")[0]; // "YYYY-MM-DD"

    // Vérifier si le sitter existe
    const sitter = await prisma.sitterProfile.findUnique({
      where: { sitterId },
      select: { id: true },
    });

    if (!sitter) {
      return NextResponse.json({ error: "Sitter not found" }, { status: 404 });
    }

    // Récupérer les règles de disponibilité pour ce jour
    const rules = await prisma.availabilityRule.findMany({
      where: {
        sitterId,
        ...(serviceType ? { serviceType } : {}),
        dayOfWeek,
      },
    });

    // Vérifier les exceptions
    const exceptions = await prisma.availabilityException.findMany({
      where: {
        sitterId,
        ...(serviceType ? { serviceType } : {}),
        date: dateObj,
      },
    });

    // Vérifier le statut global du jour
    const dayStatus = await prisma.availability.findUnique({
      where: {
        sitterId_dateKey: { sitterId, dateKey },
      },
    });

    // Si pas de règles, le sitter n'a pas configuré ses dispos
    if (rules.length === 0 && exceptions.length === 0) {
      return NextResponse.json({
        available: false,
        reason: "Aucune disponibilité configurée pour ce jour",
        slots: [],
      });
    }

    // Construire les créneaux disponibles
    const activeRules = exceptions.length > 0 ? exceptions : rules;
    const slots = activeRules
      .filter((r) => r.status === "AVAILABLE" || r.status === "ON_REQUEST")
      .map((r) => ({
        startMin: r.startMin,
        endMin: r.endMin,
        status: r.status,
        serviceType: (r as any).serviceType || serviceType,
      }));

    const isGloballyUnavailable = dayStatus && !dayStatus.isAvailable;

    const result = {
      available: !isGloballyUnavailable && slots.length > 0,
      date: dateKey,
      sitterId,
      dayStatus: dayStatus?.isAvailable ? "AVAILABLE" : isGloballyUnavailable ? "UNAVAILABLE" : "AVAILABLE",
      slots,
      totalSlots: slots.length,
    };

    // Logger
    const durationMs = Date.now() - start;
    await prisma.agentLog.create({
      data: {
        agentName: "dispo_agent",
        actionType: "availability_check",
        summary: `Disponibilité ${sitterId} pour ${dateKey}: ${result.available ? "✅" : "❌"}`,
        details: { sitterId, date: dateKey, serviceType, result },
        targetId: sitterId,
        durationMs,
        status: "success",
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[agents/availability] Error:", error);
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 });
  }
}