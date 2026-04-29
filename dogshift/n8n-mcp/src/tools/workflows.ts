const N8N_BASE_URL = process.env.N8N_BASE_URL || "https://dogshift.app.n8n.cloud";
const N8N_API_KEY = process.env.N8N_API_KEY;

function headers() {
  return {
    "X-N8N-API-KEY": N8N_API_KEY || "",
    "Content-Type": "application/json",
  };
}

async function apiFetch(path: string, options?: RequestInit) {
  const url = `${N8N_BASE_URL}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...options?.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n API error ${res.status}: ${text}`);
  }
  return res.json();
}

interface N8nTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: Record<string, any>) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
}

export const n8nTools: N8nTool[] = [
  // ─── Workflows n8n ───
  {
    name: "list_workflows",
    description: "Liste tous les workflows n8n avec leur statut (actif/inactif)",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const data = await apiFetch("/workflows");
      return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
    },
  },
  {
    name: "get_workflow",
    description: "Détails d'un workflow spécifique par son ID",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID du workflow n8n" } },
      required: ["id"],
    },
    handler: async (args) => {
      const data = await apiFetch(`/workflows/${args.id}`);
      return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
    },
  },
  {
    name: "activate_workflow",
    description: "Active un workflow n8n (le met en production)",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID du workflow à activer" } },
      required: ["id"],
    },
    handler: async (args) => {
      await apiFetch(`/workflows/${args.id}/activate`, { method: "POST" });
      return { content: [{ type: "text", text: `✅ Workflow ${args.id} activé` }] };
    },
  },
  {
    name: "deactivate_workflow",
    description: "Désactive un workflow n8n",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID du workflow à désactiver" } },
      required: ["id"],
    },
    handler: async (args) => {
      await apiFetch(`/workflows/${args.id}/deactivate`, { method: "POST" });
      return { content: [{ type: "text", text: `⏸️ Workflow ${args.id} désactivé` }] };
    },
  },
  {
    name: "run_workflow",
    description: "Déclenche manuellement l'exécution d'un workflow",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID du workflow à exécuter" },
        data: { type: "object", description: "Données à passer au workflow (optionnel)" },
      },
      required: ["id"],
    },
    handler: async (args) => {
      const body = args.data ? { data: args.data } : {};
      const data = await apiFetch(`/workflows/${args.id}/execute`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return { content: [{ type: "text", text: `🚀 Workflow ${args.id} lancé → execution ID: ${data.executionId}` }] };
    },
  },
  {
    name: "list_executions",
    description: "Liste les dernières exécutions de workflows",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Nombre max de résultats (défaut: 20)", default: 20 },
        status: { type: "string", enum: ["success", "error", "running", "waiting"], description: "Filtrer par statut" },
      },
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      if (args.limit) params.set("limit", args.limit);
      if (args.status) params.set("status", args.status);
      const data = await apiFetch(`/executions?${params}`);
      return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
    },
  },
  {
    name: "get_execution",
    description: "Détails complets d'une exécution (logs, données, erreurs)",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID de l'exécution" } },
      required: ["id"],
    },
    handler: async (args) => {
      const data = await apiFetch(`/executions/${args.id}`);
      return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
    },
  },
  {
    name: "list_tags",
    description: "Liste les tags utilisés pour organiser les workflows",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const data = await apiFetch("/tags");
      return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
    },
  },

  // ─── Agents Autonomes DogShift ───
  {
    name: "agent_create_booking",
    description: "Crée une nouvelle réservation (booking) sur DogShift",
    inputSchema: {
      type: "object",
      properties: {
        sitterId: { type: "string", description: "ID du sitter" },
        userId: { type: "string", description: "ID de l'utilisateur (owner)" },
        startAt: { type: "string", description: "Date/heure début (ISO 8601)" },
        endAt: { type: "string", description: "Date/heure fin (ISO 8601)" },
        serviceType: { type: "string", enum: ["PROMENADE", "DOGSITTING", "PENSION"], description: "Type de service" },
        message: { type: "string", description: "Message optionnel" },
      },
      required: ["sitterId", "userId", "startAt", "endAt", "serviceType"],
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${N8N_BASE_URL}/api/agents/booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create_booking", ...args }),
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `❌ Erreur: ${err.message}` }], isError: true };
      }
    },
  },
  {
    name: "agent_cancel_booking",
    description: "Annule une réservation existante sur DogShift",
    inputSchema: {
      type: "object",
      properties: {
        bookingId: { type: "string", description: "ID de la réservation à annuler" },
      },
      required: ["bookingId"],
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${N8N_BASE_URL}/api/agents/booking`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel_booking", bookingId: args.bookingId }),
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `❌ Erreur: ${err.message}` }], isError: true };
      }
    },
  },
  {
    name: "agent_check_availability",
    description: "Vérifie les disponibilités d'un sitter pour une date donnée",
    inputSchema: {
      type: "object",
      properties: {
        sitterId: { type: "string", description: "ID du sitter" },
        date: { type: "string", description: "Date (YYYY-MM-DD)" },
        serviceType: { type: "string", enum: ["PROMENADE", "DOGSITTING", "PENSION"], description: "Type de service (optionnel)" },
      },
      required: ["sitterId", "date"],
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${N8N_BASE_URL}/api/agents/availability`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `❌ Erreur: ${err.message}` }], isError: true };
      }
    },
  },
  {
    name: "agent_send_notification",
    description: "Envoie une notification in-app à un utilisateur DogShift",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "ID de l'utilisateur destinataire" },
        message: { type: "string", description: "Contenu du message" },
        title: { type: "string", description: "Titre de la notification (optionnel)" },
        type: { type: "string", description: "Type de notification (optionnel)" },
        bookingId: { type: "string", description: "ID de réservation liée (optionnel)" },
      },
      required: ["userId", "message"],
    },
    handler: async (args) => {
      try {
        const res = await fetch(`${N8N_BASE_URL}/api/agents/notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "notify", ...args }),
        });
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `❌ Erreur: ${err.message}` }], isError: true };
      }
    },
  },
  {
    name: "agent_supervision",
    description: "Récupère le statut global des agents autonomes DogShift (dernières 24h)",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      try {
        const res = await fetch(`${N8N_BASE_URL}/api/agents/supervision`);
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `❌ Erreur: ${err.message}` }], isError: true };
      }
    },
  },
  {
    name: "agent_get_logs",
    description: "Récupère les logs récents des agents autonomes",
    inputSchema: {
      type: "object",
      properties: {
        agentName: { type: "string", description: "Filtrer par nom d'agent (maestro, booking_agent, dispo_agent, etc.)" },
        status: { type: "string", enum: ["success", "error", "running"], description: "Filtrer par statut" },
        limit: { type: "number", description: "Nombre max de résultats (défaut: 50)", default: 50 },
      },
    },
    handler: async (args) => {
      try {
        const params = new URLSearchParams();
        if (args.agentName) params.set("agentName", args.agentName);
        if (args.status) params.set("status", args.status);
        if (args.limit) params.set("limit", args.limit);
        const res = await fetch(`${N8N_BASE_URL}/api/agents/logs?${params}`);
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `❌ Erreur: ${err.message}` }], isError: true };
      }
    },
  },
];
