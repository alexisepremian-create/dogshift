'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function AgentsDashboard() {
  const router = useRouter();
  const [tree, setTree] = useState<AgentNode | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agents Autonomes</h1>
          <p className="text-gray-500 mt-1">
            Orchestration des agents 24/7 — Dernière màj : {new Date().toLocaleString("fr-CH")}
          </p>
        </div>
        <button
          onClick={fetchTree}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          🔄 Rafraîchir
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arbre des agents */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">🧠 Architecture des agents</h2>

          {tree && (
            <div className="flex flex-col items-center">
              {/* Maestro */}
              <div
                onClick={() => handleAgentClick(tree)}
                className={`cursor-pointer flex items-center gap-4 p-4 rounded-xl border-2 transition-all mb-8 ${
                  selectedAgent?.id === "maestro"
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:shadow"
                }`}
              >
                <div className="text-4xl">{tree.emoji}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900">{tree.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tree.status === "online" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {tree.status === "online" ? "🟢 En ligne" : "🔴 Hors ligne"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{tree.description}</p>
                  {tree.lastLog && (
                    <p className="text-xs text-gray-400 mt-1">
                      Dernière action : {tree.lastLog.summary} — {new Date(tree.lastLog.createdAt).toLocaleString("fr-CH")}
                    </p>
                  )}
                </div>
              </div>

              {/* Ligne de connexion */}
              <div className="w-px h-8 bg-gray-300" />
              <div className="w-3/4 h-px bg-gray-300 mb-8" />

              {/* Sous-agents */}
              <div className="grid grid-cols-2 gap-4 w-full">
                {tree.children?.map((agent) => (
                  <div key={agent.id} className="flex flex-col items-center">
                    {/* Ligne verticale */}
                    <div className="w-px h-6 bg-gray-300" />

                    <div
                      onClick={() => handleAgentClick(agent)}
                      className={`cursor-pointer w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        selectedAgent?.id === agent.id
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : "border-gray-200 hover:border-blue-300 hover:shadow"
                      }`}
                    >
                      <div className="text-3xl">{agent.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 truncate">{agent.name}</h4>
                          <span className={`w-2 h-2 rounded-full ${
                            agent.status === "online" ? "bg-green-500" : "bg-red-500"
                          }`} />
                        </div>
                        <p className="text-xs text-gray-500 truncate">{agent.description}</p>
                        {agent.lastLog && (
                          <p className={`text-xs mt-1 ${
                            agent.lastLog.status === "success" ? "text-green-600" : "text-red-600"
                          }`}>
                            {agent.lastLog.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panneau de détails */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {selectedAgent ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="text-4xl">{selectedAgent.emoji}</div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedAgent.name}</h3>
                  <p className="text-sm text-gray-500">{selectedAgent.id}</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{selectedAgent.description}</p>

              {/* Actions disponibles */}
              {selectedAgent.actions && selectedAgent.actions.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">⚡ Actions disponibles</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAgent.actions.map((action) => (
                      <button
                        key={action}
                        onClick={() => handleTestAction(action)}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Résultat du test */}
              {testResult && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">📤 Résultat</h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-40 overflow-auto whitespace-pre-wrap">
                    {testResult}
                  </pre>
                </div>
              )}

              {/* Logs */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">📋 Dernières actions</h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune action pour l&apos;instant</p>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="text-xs bg-gray-50 p-2 rounded border border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            log.status === "success" ? "bg-green-500" : log.status === "error" ? "bg-red-500" : "bg-yellow-500"
                          }`} />
                          <span className="font-medium text-gray-700">{log.actionType}</span>
                          {log.durationMs && (
                            <span className="text-gray-400">{log.durationMs}ms</span>
                          )}
                        </div>
                        <p className="text-gray-600 mt-0.5">{log.summary}</p>
                        <p className="text-gray-400 mt-0.5">
                          {new Date(log.createdAt).toLocaleString("fr-CH")}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-6xl mb-4">👆</div>
              <p className="text-lg font-medium">Sélectionne un agent</p>
              <p className="text-sm">Clique sur un agent dans l'arbre pour voir ses détails</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}