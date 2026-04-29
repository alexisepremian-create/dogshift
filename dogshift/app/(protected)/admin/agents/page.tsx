'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  BrainCircuit,
  Sparkles,
  CalendarDays,
  Shield,
  RefreshCw,
  Plus,
  Minus,
  Maximize2,
  X,
  Activity,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───
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

// ─── Agent visual config ───
const AGENT_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  maestro: { icon: BrainCircuit, color: "#7c3aed", bg: "rgba(124,58,237,0.12)", label: "Maestro" },
  booking: { icon: CalendarDays, color: "#2563eb", bg: "rgba(37,99,235,0.12)", label: "Booking" },
  disponibilite: { icon: CalendarDays, color: "#059669", bg: "rgba(5,150,105,0.12)", label: "Disponibilité" },
  notification: { icon: Sparkles, color: "#d97706", bg: "rgba(217,119,6,0.12)", label: "Notification" },
  supervision: { icon: Shield, color: "#dc2626", bg: "rgba(220,38,38,0.12)", label: "Supervision" },
};

// ─── Agent circle component ───
function AgentCircle({
  agent,
  isSelected,
  onClick,
  size = 56,
}: {
  agent: AgentNode;
  isSelected: boolean;
  onClick: () => void;
  size?: number;
}) {
  const config = AGENT_CONFIG[agent.id] || AGENT_CONFIG.maestro;
  const Icon = config.icon;
  const circleSize = size;
  const iconSize = size * 0.42;

  return (
    <div className="flex flex-col items-center gap-1.5 cursor-pointer select-none" onClick={onClick}>
      <div
        className="relative flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110"
        style={{
          width: circleSize,
          height: circleSize,
          backgroundColor: isSelected ? config.color : config.bg,
          boxShadow: isSelected
            ? `0 0 0 3px white, 0 0 0 5px ${config.color}40, 0 4px 12px ${config.color}30`
            : `0 2px 8px ${config.color}15`,
        }}
      >
        <Icon
          size={iconSize}
          style={{ color: isSelected ? "white" : config.color }}
        />
        {agent.status === "online" && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white animate-pulse"
            style={{ backgroundColor: "#22c55e" }}
          />
        )}
      </div>
      <span
        className="text-[11px] font-medium tracking-tight"
        style={{
          color: isSelected ? config.color : "#64748b",
          fontWeight: isSelected ? 600 : 500,
        }}
      >
        {agent.name.split(" ")[0]}
      </span>
    </div>
  );
}

// ─── Modal ───
function AgentModal({
  agent,
  logs,
  onClose,
  onTestAction,
  testResult,
}: {
  agent: AgentNode;
  logs: any[];
  onClose: () => void;
  onTestAction: (action: string) => void;
  testResult: string | null;
}) {
  const config = AGENT_CONFIG[agent.id] || AGENT_CONFIG.maestro;
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: config.bg,
                }}
              >
                <Icon size={22} style={{ color: config.color }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{agent.name}</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{agent.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">{agent.description}</p>
        </div>

        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                agent.status === "online" ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-gray-600 font-medium">
              {agent.status === "online" ? "En ligne" : "Hors ligne"}
            </span>
            {agent.lastLog && (
              <span className="text-gray-400 text-xs ml-auto flex items-center gap-1">
                <Clock size={12} />
                {new Date(agent.lastLog.createdAt).toLocaleString("fr-CH")}
              </span>
            )}
          </div>

          {/* Actions */}
          {agent.actions && agent.actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap size={12} />
                Actions
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {agent.actions.map((action) => (
                  <button
                    key={action}
                    onClick={() => onTestAction(action)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border transition-all"
                    style={{
                      backgroundColor: config.bg,
                      borderColor: `${config.color}30`,
                      color: config.color,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = config.color + "20")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = config.bg)
                    }
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Résultat
              </h4>
              <pre className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-gray-700">
                {testResult}
              </pre>
            </div>
          )}

          {/* Logs */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity size={12} />
              Activité récente
            </h4>
            <div className="space-y-1.5">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aucune action pour l&apos;instant</p>
              ) : (
                logs.map((log: any, i: number) => (
                  <div
                    key={i}
                    className="text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      {log.status === "success" ? (
                        <CheckCircle2 size={12} className="text-green-500" />
                      ) : log.status === "error" ? (
                        <AlertCircle size={12} className="text-red-500" />
                      ) : (
                        <Activity size={12} className="text-yellow-500" />
                      )}
                      <span className="font-medium text-gray-700">
                        {log.actionType}
                      </span>
                      {log.durationMs && (
                        <span className="text-gray-400 ml-auto">
                          {log.durationMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-0.5 ml-6">{log.summary}</p>
                    <p className="text-gray-400 mt-0.5 ml-6 text-[10px]">
                      {new Date(log.createdAt).toLocaleString("fr-CH")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Canvas tree renderer ───
function AgentTreeCanvas({
  tree,
  zoom,
  pan,
  selectedId,
  onSelect,
}: {
  tree: AgentNode;
  zoom: number;
  pan: { x: number; y: number };
  selectedId: string | null;
  onSelect: (agent: AgentNode) => void;
}) {
  const children = tree.children || [];
  const childCount = children.length;
  const verticalGap = 100;
  const horizontalSpacing = 160;
  const totalWidth = Math.max(1, childCount) * horizontalSpacing;
  const startX = -totalWidth / 2 + horizontalSpacing / 2;

  return (
    <div
      className="absolute"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: "0 0",
      }}
    >
      <svg
        className="absolute pointer-events-none"
        style={{
          left: -300,
          top: -200,
          width: 600,
          height: 500,
        }}
      >
        {children.map((child, i) => {
          const x = startX + i * horizontalSpacing;
          return (
            <g key={child.id}>
              <line
                x1={0}
                y1={40}
                x2={0}
                y2={40 + verticalGap * 0.35}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeOpacity={0.25}
              />
              <line
                x1={0}
                y1={40 + verticalGap * 0.35}
                x2={x}
                y2={40 + verticalGap * 0.35}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeOpacity={0.2}
              />
              <line
                x1={x}
                y1={40 + verticalGap * 0.35}
                x2={x}
                y2={40 + verticalGap * 0.65}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeOpacity={0.25}
              />
            </g>
          );
        })}
      </svg>

      {/* Maestro */}
      <div className="absolute" style={{ left: -28, top: 0 }}>
        <AgentCircle
          agent={tree}
          isSelected={selectedId === "maestro"}
          onClick={() => onSelect(tree)}
          size={56}
        />
      </div>

      {/* Children */}
      {children.map((child, i) => {
        const x = startX + i * horizontalSpacing - 22;
        return (
          <div
            key={child.id}
            className="absolute"
            style={{ left: x, top: 40 + verticalGap }}
          >
            <AgentCircle
              agent={child}
              isSelected={selectedId === child.id}
              onClick={() => onSelect(child)}
              size={44}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ───
function AgentSkeleton() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-14 h-14 bg-gray-200 rounded-full" />
        <div className="w-20 h-3 bg-gray-200 rounded" />
        <div className="flex gap-8 mt-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 bg-gray-100 rounded-full" />
              <div className="w-16 h-2.5 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Global style override for fullscreen ───
const fullscreenStyles = `
  .agents-fullscreen main {
    padding: 0 !important;
    margin: 0 !important;
  }
  .agents-fullscreen header {
    display: none !important;
  }
`;

// ─── Main page ───
export default function AgentsDashboard() {
  const [tree, setTree] = useState<AgentNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTree();
    // Add fullscreen class to parent
    const el = document.querySelector('.agents-fullscreen main');
  }, []);

  async function fetchTree() {
    try {
      const res = await fetch("/api/maestro");
      const data: AgentTree = await res.json();
      setTree(data.tree);
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setPan({ x: rect.width / 2, y: rect.height / 3 });
      }
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

  // ─── Canvas interactions ───
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((z) => Math.max(0.2, Math.min(3, z + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        setPanOrigin({ x: pan.x, y: pan.y });
      }
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: panOrigin.x + dx, y: panOrigin.y + dy });
    },
    [isPanning, panStart, panOrigin]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const sidebarWidth = 288;

  if (loading) return <AgentSkeleton />;

  return (
    <div className="agents-fullscreen">
      {/* Override admin layout styles */}
      <style>{fullscreenStyles}</style>

      {/* Top bar */}
      <div
        className="fixed top-0 right-0 z-40 flex items-center justify-between px-6 py-3"
        style={{ left: sidebarWidth }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bot size={20} className="text-violet-600" />
            Agents
          </h1>
          <span className="text-xs text-gray-400 hidden sm:inline">
            Ctrl+molette zoom • Glisser pour naviguer
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1 w-8 text-right">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Zoom arrière"
          >
            <Minus size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => {
              setZoom(0.85);
              if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setPan({ x: rect.width / 2, y: rect.height / 3 });
              }
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Réinitialiser"
          >
            <Maximize2 size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Zoom avant"
          >
            <Plus size={14} className="text-gray-500" />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={fetchTree}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Rafraîchir"
          >
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Fullscreen canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ top: 0, left: sidebarWidth, bottom: 0, right: 0 }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot grid */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.4 }}
        >
          <defs>
            <pattern
              id="grid"
              width={24}
              height={24}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x % 24}, ${pan.y % 24}) scale(${zoom})`}
            >
              <circle cx={12} cy={12} r={1} fill="#cbd5e1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Agents tree */}
        {tree && (
          <AgentTreeCanvas
            tree={tree}
            zoom={zoom}
            pan={pan}
            selectedId={selectedAgent?.id || null}
            onSelect={handleAgentClick}
          />
        )}
      </div>

      {/* Modal */}
      {selectedAgent && (
        <AgentModal
          agent={selectedAgent}
          logs={logs}
          testResult={testResult}
          onClose={() => {
            setSelectedAgent(null);
            setTestResult(null);
          }}
          onTestAction={handleTestAction}
        />
      )}
    </div>
  );
}
