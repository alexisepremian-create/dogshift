'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, BrainCircuit, Sparkles, Workflow, RefreshCw, Plus, Minus, Maximize2, CalendarDays, Shield } from "lucide-react";

interface AgentNode {
  id: string;
  name: string;
  emoji: string;
  description: string;
  status: string;
  actions?: string[];
  children?: AgentNode[];
  lastLog?: {
    summary: string;
    status: string;
    createdAt: string;
    durationMs: number;
  } | null;
}

interface AgentTree {
  tree: AgentNode;
}

const AGENT_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  maestro: { icon: BrainCircuit, color: "#7c3aed", bg: "#f5f3ff", border: "border-violet-200" },
  booking: { icon: CalendarDays, color: "#2563eb", bg: "#eff6ff", border: "border-blue-200" },
  disponibilite: { icon: CalendarDays, color: "#059669", bg: "#ecfdf5", border: "border-emerald-200" },
  notification: { icon: Sparkles, color: "#d97706", bg: "#fffbeb", border: "border-amber-200" },
  supervision: { icon: Shield, color: "#dc2626", bg: "#fef2f2", border: "border-red-200" },
};

function AgentSkeleton() {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
          <div className="flex flex-col items-center">
            <div className="h-24 w-64 bg-gray-100 rounded-xl mb-8" />
            <div className="w-px h-8 bg-gray-200" />
            <div className="w-3/4 h-px bg-gray-200 mb-8" />
            <div className="grid grid-cols-2 gap-4 w-full">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-px h-6 bg-gray-200" />
                  <div className="h-20 w-full bg-gray-100 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-20 w-full bg-gray-100 rounded-xl mb-4" />
          <div className="h-4 w-3/4 bg-gray-100 rounded mb-6" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentIcon({ id, size = 40 }: { id: string; size?: number }) {
  const config = AGENT_CONFIG[id];
  if (!config) {
    return (
      <div
        className="flex items-center justify-center rounded-full shadow-sm border-2 border-white bg-gray-100"
        style={{ width: size, height: size }}
      >
        <Bot size={size * 0.5} className="text-gray-400" />
      </div>
    );
  }
  const Icon = config.icon;
  return (
    <div
      className="flex items-center justify-center rounded-full shadow-sm border-2 border-white"
      style={{ width: size, height: size, backgroundColor: config.bg }}
    >
      <Icon size={size * 0.5} style={{ color: config.color }} />
    </div>
  );
}

export default function AgentsDashboard() {
  const [tree, setTree] = useState<AgentNode | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTree();
  }, []);

  async function fetchTree() {
    try {
      const res = await fetch("/api/maestro");
      const data: AgentTree = await res.json();
      setTree(data.tree);
    } catch (e) {
      console.error("Failed to fetch agent tree", e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs(agentId: string) {
    try {
      const res = await fetch(`/api/agents/logs?agentName=${agentId}&limit=20`);
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      setLogs([]);
    }
  }

  function handleAgentClick(agent: AgentNode) {
    setSelectedAgent(agent);
    fetchLogs(agent.id);
    setTestResult(null);
  }

  async function handleTestAction(action: string) {
    setTestResult(`Exécution de "${action}"...`);
    try {
      const res = await fetch("/api/maestro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sitterId: "test",
          userId: "test",
          date: new Date().toISOString().split("T")[0],
        }),
      });
      const data = await res.json();
      setTestResult(JSON.stringify(data, null, 2));
      fetchTree();
      if (selectedAgent) fetchLogs(selectedAgent.id);
    } catch (e) {
      setTestResult(`Erreur: ${(e as Error).message}`);
    }
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.max(0.3, Math.min(2, z - e.deltaY * 0.002)));
    }
  }, []);

  if (loading) return <AgentSkeleton />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            <Bot size={28} className="inline mr-2 text-violet-600" />
            Agents Autonomes
          </h1>
          <p className="text-gray-500 mt-1">
            Orchestration des agents 24/7 — Dernière màj : {new Date().toLocaleString("fr-CH")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-1">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="Zoom arrière"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="Réinitialiser"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="Zoom avant"
          >
            <Plus size={16} />
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button
            onClick={fetchTree}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arbre des agents avec zoom */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Workflow size={20} className="text-violet-500" />
              Architecture des agents
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Ctrl + molette pour zoomer • Clique sur un agent pour voir ses détails
            </p>
          </div>

          <div
            ref={containerRef}
            className="overflow-auto p-6"
            style={{ minHeight: 500, maxHeight: 700 }}
            onWheel={handleWheel}
          >
            {tree && (
              <div
                className="flex flex-col items-center transition-transform duration-100 origin-top-center"
                style={{ transform: `scale(${zoom})` }}
              >
                {/* Maestro */}
                <div
                  onClick={() => handleAgentClick(tree)}
                  className={`cursor-pointer flex items-center gap-4 p-4 rounded-2xl border-2 transition-all mb-6 min-w-[280px] ${
                    selectedAgent?.id === "maestro"
                      ? "border-violet-400 bg-violet-50 shadow-lg shadow-violet-100"
                      : "border-gray-200 hover:border-violet-300 hover:shadow-md"
                  }`}
                >
                  <AgentIcon id="maestro" size={52} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{tree.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        tree.status === "online" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {tree.status === "online" ? "● En ligne" : "● Hors ligne"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{tree.description}</p>
                    {tree.lastLog && (
                      <p className="text-xs text-gray-400 mt-1">
                        Dernière action : {new Date(tree.lastLog.createdAt).toLocaleString("fr-CH")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lignes de connexion */}
                <div className="w-px h-6 bg-gradient-to-b from-violet-300 to-blue-200" />
                <div className="w-2/3 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent mb-6" />

                {/* Sous-agents */}
                <div className="grid grid-cols-2 gap-5 w-full max-w-2xl">
                  {tree.children?.map((agent) => {
                    const config = AGENT_CONFIG[agent.id];
                    const borderColor = config?.border || "border-gray-200";
                    return (
                      <div key={agent.id} className="flex flex-col items-center">
                        <div className="w-px h-5 bg-gradient-to-b from-blue-200 to-gray-300" />
                        <div
                          onClick={() => handleAgentClick(agent)}
                          className={`cursor-pointer w-full p-4 rounded-2xl border-2 transition-all ${
                            selectedAgent?.id === agent.id
                              ? "border-blue-400 bg-blue-50 shadow-lg shadow-blue-100"
                              : `${borderColor} hover:shadow-md`
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <AgentIcon id={agent.id} size={44} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900 truncate">{agent.name}</h4>
                                <span className={`w-2 h-2 rounded-full ${
                                  agent.status === "online" ? "bg-green-500 animate-pulse" : "bg-red-500"
                                }`} />
                              </div>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{agent.description}</p>
                            </div>
                          </div>
                          {agent.lastLog && (
                            <div className={`mt-2 pt-2 border-t border-gray-100 text-xs ${
                              agent.lastLog.status === "success" ? "text-green-600" : "text-red-600"
                            }`}>
                              {agent.lastLog.summary}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panneau de détails */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {selectedAgent ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <AgentIcon id={selectedAgent.id} size={52} />
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedAgent.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">{selectedAgent.id}</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6 leading-relaxed">{selectedAgent.description}</p>

              {/* Actions disponibles */}
              {selectedAgent.actions && selectedAgent.actions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">⚡ Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAgent.actions.map((action) => (
                      <button
                        key={action}
                        onClick={() => handleTestAction(action)}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 rounded-lg border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Test result */}
              {testResult && (
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">📤 Résultat</h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-32 overflow-auto whitespace-pre-wrap font-mono">
                    {testResult}
                  </pre>
                </div>
              )}

              {/* Logs */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📋 Activité récente</h4>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {logs.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Aucune action pour l&apos;instant</p>
                  ) : (
                    logs.map((log: any, i: number) => (
                      <div key={i} className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === "success" ? "bg-green-500" : log.status === "error" ? "bg-red-500" : "bg-yellow-500"
                          }`} />
                          <span className="font-semibold text-gray-700">{log.actionType}</span>
                          {log.durationMs && (
                            <span className="text-gray-400 ml-auto">{log.durationMs}ms</span>
                          )}
                        </div>
                        <p className="text-gray-600">{log.summary}</p>
                        <p className="text-gray-400 mt-1 text-[10px]">
                          {new Date(log.createdAt).toLocaleString("fr-CH")}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
              <div className="relative mb-6">
                <Bot size={80} className="text-gray-200" />
                <span className="absolute -top-2 -right-2 text-3xl">👆</span>
              </div>
              <p className="text-lg font-medium text-gray-500">Sélectionne un agent</p>
              <p className="text-sm mt-1">Clique sur un agent dans l'arbre</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
