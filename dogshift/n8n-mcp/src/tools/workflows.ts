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
  {
    name: "list_workflows",
    description: "Liste tous les workflows n8n avec leur statut (actif/inactif)",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const data = await apiFetch("/workflows");
      return {
        content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }],
      };
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
    handler: async (args: Record<string, any>) => {
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
    handler: async (args: Record<string, any>) => {
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
    handler: async (args: Record<string, any>) => {
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
    handler: async (args: Record<string, any>) => {
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
    handler: async (args: Record<string, any>) => {
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
    handler: async (args: Record<string, any>) => {
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
];