import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://dogshift.vercel.app";

interface AgentRoute {
  url: string;
  method: "POST" | "GET";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: Record<string, any>;
}

const AGENT_REGISTRY: Record<string, AgentRoute> = {
  // ─── Agents existants ───
  check_availability: {
    url: `${BASE_URL}/api/agents/availability`,
    method: "POST",
  },
  disponibilite: {
    url: `${BASE_URL}/api/agents/availability`,
    method: "POST",
  },
  create_booking: {
    url: `${BASE_URL}/api/agents/booking`,
    method: "POST",
  },
  cancel_booking: {
    url: `${BASE_URL}/api/agents/booking`,
    method: "POST",
  },
  get_booking: {
    url: `${BASE_URL}/api/agents/booking`,
    method: "POST",
  },
  notify: {
    url: `${BASE_URL}/api/agents/notification`,
    method: "POST",
  },
  status: {
    url: `${BASE_URL}/api/agents/supervision`,
    method: "GET",
  },
  health: {
    url: `${BASE_URL}/api/agents/supervision`,
    method: "GET",
  },

  // ─── NOUVEAUX AGENTS (remplacent n8n) ───
  candidature_apply: {
    url: `${BASE_URL}/api/agents/candidature`,
    method: "POST",
  },
  contrat_send: {
    url: `${BASE_URL}/api/agents/contrat`,
    method: "POST",
    body: { action: "send_contract" },
  },
  contrat_signed: {
    url: `${BASE_URL}/api/agents/contrat`,
    method: "POST",
    body: { action: "contract_signed" },
  },
  activation_new: {
    url: `${BASE_URL}/api/agents/activation`,
    method: "POST",
  },
  calendrier_booking: {
    url: `${BASE_URL}/api/agents/calendrier`,
    method: "POST",
  },
  lead_magnet_captured: {
    url: `${BASE_URL}/api/agents/lead-magnet`,
    method: "POST",
  },
  owner_registered: {
    url: `${BASE_URL}/api/agents/onboarding-owner`,
    method: "POST",
  },
  zootherapie_evaluation: {
    url: `${BASE_URL}/api/agents/zootherapie-evaluation`,
    method: "POST",
  },
  relance_owner: {
    url: `${BASE_URL}/api/agents/relance-owner`,
    method: "POST",
  },
  deps_nightly_run: {
    url: `${BASE_URL}/api/agents/deps-agent`,
    method: "POST",
  },
  deps_weekly_run: {
    url: `${BASE_URL}/api/agents/deps-weekly`,
    method: "POST",
  },
  dog_news_run: {
    url: `${BASE_URL}/api/agents/dog-news`,
    method: "POST",
  },
};

// ─── Arbre des agents pour le frontend ───
export const AGENTS_TREE = {
  id: "maestro",
  name: "Maestro",
  emoji: "🎯",
  description: "Orchestrateur principal - reçoit toutes les requêtes et délègue aux sous-agents",
  status: "online",
  children: [
    // Opérationnels
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
    // Nouveaux agents n8n
    {
      id: "candidature",
      name: "Candidature Agent",
      emoji: "📋",
      description: "Analyse les candidatures sitters (score, décision, notifications)",
      status: "online",
      actions: ["candidature_apply"],
    },
    {
      id: "contrat",
      name: "Contrat Agent",
      emoji: "📝",
      description: "Gère l'envoi et la signature des contrats",
      status: "online",
      actions: ["contrat_send", "contrat_signed"],
    },
    {
      id: "activation",
      name: "Activation Agent",
      emoji: "✅",
      description: "Notifie les nouveaux sitters inscrits",
      status: "online",
      actions: ["activation_new"],
    },
    {
      id: "calendrier",
      name: "Calendrier Agent",
      emoji: "📅",
      description: "Notifie les événements Cal.com (création, annulation, replanification)",
      status: "online",
      actions: ["calendrier_booking"],
    },
    {
      id: "lead-magnet",
      name: "Lead Magnet Agent",
      emoji: "📧",
      description: "Capture les leads email et envoie le guide gratuit DogShift",
      status: "online",
      actions: ["lead_magnet_captured"],
    },
    {
      id: "onboarding-owner",
      name: "Onboarding Owner Agent",
      emoji: "🏠",
      description: "Onboarding des nouveaux propriétaires : email de bienvenue + suivi J+3",
      status: "online",
      actions: ["owner_registered"],
    },
    {
      id: "relance-owner",
      name: "Relance Owner Agent",
      emoji: "💌",
      description: "Relance les propriétaires qui ont échangé avec un sitter sans réserver (email personnalisé par Claude)",
      status: "online",
      actions: ["relance_owner"],
    },
    {
      id: "zootherapie-evaluation",
      name: "Zoothérapie Evaluation",
      emoji: "🧘",
      description: "Génère une évaluation bien-être personnalisée via Claude et envoie par email",
      status: "online",
      actions: ["zootherapie_evaluation"],
    },
  ],
};

// ─── POST /api/maestro ───
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestBody: Record<string, any> = { ...(route.body || {}) };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        requestBody[key] = value;
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

    // Logger
    const errorDetail = !response.ok
      ? (typeof data?.error === "string" ? data.error : `HTTP ${response.status}`)
      : null;
    await prisma.agentLog.create({
      data: {
        agentName: "maestro",
        actionType: `call_${action}`,
        summary: response.ok
          ? `Action "${action}" réussie en ${durationMs}ms`
          : `Action "${action}" échouée — ${errorDetail} (${durationMs}ms)`,
        details: { action, params, durationMs, httpStatus: response.status, response: data },
        targetId: data?.bookingId || data?.sitterId || data?.applicationId || null,
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

// ─── GET /api/maestro (pour le dashboard) ───
export async function GET() {
  const agentList = AGENTS_TREE.children.map(async (agent) => {
    const lastLog = await prisma.agentLog.findFirst({
      where: { agentName: agent.id },
      orderBy: { createdAt: "desc" },
      select: { summary: true, status: true, createdAt: true, durationMs: true },
    });
    return { ...agent, lastLog };
  });

  const childrenWithLogs = await Promise.all(agentList);

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
