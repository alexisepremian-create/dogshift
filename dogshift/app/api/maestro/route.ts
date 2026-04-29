import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://dogshift.vercel.app";

interface AgentRoute {
  url: string;
  method: "POST" | "GET";
  body: Record<string, any>;
}

const AGENT_REGISTRY: Record<string, AgentRoute> = {
  check_availability: {
    url: `${BASE_URL}/api/agents/availability`,
    method: "POST",
    body: { sitterId: "", date: "", serviceType: "" },
  },
  disponibilite: {
    url: `${BASE_URL}/api/agents/availability`,
    method: "POST",
    body: { sitterId: "", date: "", serviceType: "" },
  },
  create_booking: {
    url: `${BASE_URL}/api/agents/booking`,
    method: "POST",
    body: { action: "create_booking", sitterId: "", userId: "", startAt: "", endAt: "", serviceType: "" },
  },
  cancel_booking: {
    url: `${BASE_URL}/api/agents/booking`,
    method: "POST",
    body: { action: "cancel_booking", bookingId: "" },
  },
  get_booking: {
    url: `${BASE_URL}/api/agents/booking`,
    method: "POST",
    body: { action: "get_booking", bookingId: "" },
  },
  notify: {
    url: `${BASE_URL}/api/agents/notification`,
    method: "POST",
    body: { action: "notify", userId: "", message: "" },
  },
  status: {
    url: `${BASE_URL}/api/agents/supervision`,
    method: "GET",
    body: {},
  },
  health: {
    url: `${BASE_URL}/api/agents/supervision`,
    method: "GET",
    body: {},
  },
};

// Structure des agents pour le frontend
export const AGENTS_TREE = {
  id: "maestro",
  name: "Maestro",
  emoji: "🎯",
  description: "Orchestrateur principal - reçoit toutes les requêtes et délègue aux sous-agents",
  status: "online",
  children: [
    {
      id: "booking",
      name: "Booking Agent",
      emoji: "📅",
      description: "Gère les réservations (création, annulation, consultation)",
      status: "online",
      actions: ["create_booking", "cancel_booking", "get_booking"],
    },
    {
      id: "disponibilite",
      name: "Disponibilité Agent",
      emoji: "📆",
      description: "Vérifie les créneaux disponibles des sitters",
      status: "online",
      actions: ["check_availability"],
    },
    {
      id: "notification",
      name: "Notification Agent",
      emoji: "🔔",
      description: "Envoie des notifications in-app aux utilisateurs",
      status: "online",
      actions: ["notify"],
    },
    {
      id: "supervision",
      name: "Supervision Agent",
      emoji: "🛡️",
      description: "Surveille l'état de tous les agents",
      status: "online",
      actions: ["status", "health"],
    },
  ],
};

/**
 * POST /api/maestro
 * Reçoit une requête, détermine l'intention, appelle le sous-agent
 */
export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const body = await req.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json({ error: "Action requise", available_actions: Object.keys(AGENT_REGISTRY) }, { status: 400 });
    }

    const route = AGENT_REGISTRY[action];
    if (!route) {
      return NextResponse.json({
        error: `Action inconnue: ${action}`,
        available_actions: Object.keys(AGENT_REGISTRY),
      }, { status: 400 });
    }

    // Construire le body avec les paramètres reçus
    const requestBody = { ...route.body };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        (requestBody as any)[key] = value;
      }
    }

    // Appeler le sous-agent
    const response = await fetch(route.url, {
      method: route.method,
      headers: { "Content-Type": "application/json" },
      body: route.method === "POST" ? JSON.stringify(requestBody) : undefined,
    });

    const data = await response.json();
    const durationMs = Date.now() - start;

    // Logger l'appel
    await prisma.agentLog.create({
      data: {
        agentName: "maestro",
        actionType: `call_${action}`,
        summary: `Action "${action}" exécutée en ${durationMs}ms`,
        details: { action, params, durationMs },
        targetId: (data as any).bookingId || (data as any).sitterId || null,
        durationMs,
        status: response.ok ? "success" : "error",
      },
    }).catch(() => {});

    return NextResponse.json({
      success: response.ok,
      action,
      durationMs,
      result: data,
    });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.agentLog.create({
      data: {
        agentName: "maestro",
        actionType: "error",
        summary: `Erreur: ${(error as Error).message}`,
        details: { error: String(error) },
        durationMs,
        status: "error",
      },
    }).catch(() => {});

    return NextResponse.json({ error: "Erreur Maestro", details: (error as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/maestro
 * Retourne l'arbre des agents (utilisé par le frontend dashboard)
 */
export async function GET() {
  // Récupérer les logs récents pour chaque agent
  const agents = AGENTS_TREE.children.map(async (agent) => {
    const lastLog = await prisma.agentLog.findFirst({
      where: { agentName: agent.id },
      orderBy: { createdAt: "desc" },
      select: { summary: true, status: true, createdAt: true, durationMs: true },
    });
    return { ...agent, lastLog };
  });

  const childrenWithLogs = await Promise.all(agents);

  // Dernière exécution du Maestro
  const maestroLastLog = await prisma.agentLog.findFirst({
    where: { agentName: "maestro" },
    orderBy: { createdAt: "desc" },
    select: { summary: true, status: true, createdAt: true, durationMs: true },
  });

  return NextResponse.json({
    tree: {
      ...AGENTS_TREE,
      lastLog: maestroLastLog,
      children: childrenWithLogs,
    },
  });
}