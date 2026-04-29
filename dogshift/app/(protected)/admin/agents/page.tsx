'use client';

import { type ElementType, useState, useEffect, useRef, useCallback } from "react";
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
  FileText,
  UserCheck,
  BellRing,
  SearchCheck,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface AgentLog {
  status: string;
  actionType: string;
  summary: string;
  durationMs?: number;
  createdAt: string;
}

// ─── Color config ─────────────────────────────────────────────────────────────

const COLORS: Record<string, { icon: ElementType; color: string; bg: string }> = {
  maestro:       { icon: BrainCircuit, color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
  booking:       { icon: CalendarDays, color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  disponibilite: { icon: CalendarDays, color: "#059669", bg: "rgba(5,150,105,0.12)" },
  notification:  { icon: Sparkles,     color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  supervision:   { icon: Shield,       color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  candidature:   { icon: SearchCheck,  color: "#0891b2", bg: "rgba(8,145,178,0.12)" },
  contrat:       { icon: FileText,     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  activation:    { icon: UserCheck,    color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
  calendrier:    { icon: BellRing,     color: "#e11d48", bg: "rgba(225,29,72,0.12)" },
};

const DEFAULT_COLOR = { icon: Bot, color: "#64748b", bg: "rgba(100,116,139,0.12)" };

function getColor(id: string) {
  return COLORS[id] ?? DEFAULT_COLOR;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 288;
const VERTICAL_GAP = 130;
const HORIZONTAL_SPACING = 140;
const MAESTRO_SIZE = 64;
const CHILD_SIZE = 48;

// ─── Agent circle ─────────────────────────────────────────────────────────────

function AgentCircle({
  agent,
  isSelected,
  onClick,
  size = 50,
}: {
  agent: AgentNode;
  isSelected: boolean;
  onClick: () => void;
  size?: number;
}) {
  const c = getColor(agent.id);
  const Icon = c.icon;
  const iconSize = size * 0.44;

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer select-none" onClick={onClick}>
      <div
        className="relative flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-105"
        style={{
          width: size,
          height: size,
          backgroundColor: isSelected ? c.color : c.bg,
          boxShadow: isSelected
            ? `0 0 0 3px white, 0 0 0 5px ${c.color}50, 0 4px 16px ${c.color}30`
            : `0 2px 8px rgba(0,0,0,0.06)`,
        }}
      >
        <Icon size={iconSize} style={{ color: isSelected ? "white" : c.color }} />
        {agent.status === "online" && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
            style={{ backgroundColor: "#22c55e", animation: "agentPulse 2s ease-in-out infinite" }}
          />
        )}
      </div>
      <span
        className="text-sm font-medium tracking-tight"
        style={{ color: isSelected ? c.color : "#475569" }}
      >
        {agent.name.split(" ")[0]}
      </span>
    </div>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function AgentModal({
  agent,
  logs,
  onClose,
  onTestAction,
  testResult,
}: {
  agent: AgentNode;
  logs: AgentLog[];
  onClose: () => void;
  onTestAction: (action: string) => void;
  testResult: string | null;
}) {
  const c = getColor(agent.id);
  const Icon = c.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 48, height: 48, backgroundColor: c.bg }}
              >
                <Icon size={22} style={{ color: c.color }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{agent.name}</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{agent.id}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">{agent.description}</p>
        </div>

        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${agent.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
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

          {agent.actions && agent.actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap size={12} /> Actions
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {agent.actions.map((action) => (
                  <button
                    key={action}
                    onClick={() => onTestAction(action)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border transition-all"
                    style={{ backgroundColor: c.bg, borderColor: `${c.color}30`, color: c.color }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.color + "20")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.bg)}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {testResult && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Résultat</h4>
              <pre className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-28 overflow-auto whitespace-pre-wrap font-mono text-gray-700">
                {testResult}
              </pre>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity size={12} /> Activité récente
            </h4>
            <div className="space-y-1.5">
              {logs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aucune action pour l&apos;instant</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      {log.status === "success" ? (
                        <CheckCircle2 size={12} className="text-green-500" />
                      ) : log.status === "error" ? (
                        <AlertCircle size={12} className="text-red-500" />
                      ) : (
                        <Activity size={12} className="text-yellow-500" />
                      )}
                      <span className="font-medium text-gray-700">{log.actionType}</span>
                      {log.durationMs && <span className="text-gray-400 ml-auto">{log.durationMs}ms</span>}
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

// ─── Tree canvas ──────────────────────────────────────────────────────────────

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
  const children = tree.children ?? [];
  const childCount = children.length;
  const totalWidth = childCount * HORIZONTAL_SPACING;
  const startX = -totalWidth / 2;

  const childPositions = children.map((_, i) => ({
    cx: startX + i * HORIZONTAL_SPACING + HORIZONTAL_SPACING / 2,
    cy: VERTICAL_GAP,
  }));

  return (
    <div
      className="absolute"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: "0 0",
      }}
    >
      {/* Maestro — center at (0, MAESTRO_SIZE/2) */}
      <div style={{ position: "absolute", left: -MAESTRO_SIZE / 2, top: 0 }}>
        <AgentCircle
          agent={tree}
          isSelected={selectedId === tree.id}
          onClick={() => onSelect(tree)}
          size={MAESTRO_SIZE}
        />
      </div>

      {/* Sub-agents */}
      {children.map((child, i) => (
        <div
          key={child.id}
          style={{ position: "absolute", left: childPositions[i].cx - CHILD_SIZE / 2, top: childPositions[i].cy }}
        >
          <AgentCircle
            agent={child}
            isSelected={selectedId === child.id}
            onClick={() => onSelect(child)}
            size={CHILD_SIZE}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AgentSkeleton() {
  return (
    <div className="flex items-center justify-center" style={{ height: "100vh" }}>
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="w-24 h-3.5 bg-gray-200 rounded" />
        <div className="flex gap-8 mt-12">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gray-100 rounded-full" />
              <div className="w-14 h-3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Global overrides injected while this page is mounted ─────────────────────

const fullscreenStyles = `
  body.agents-canvas-active header { display: none !important; }
  body.agents-canvas-active main   { padding: 0 !important; overflow: hidden !important; }
  @keyframes agentPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.6; transform: scale(0.85); }
  }
`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsDashboard() {
  const [tree, setTree] = useState<AgentNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const hasCentered = useRef(false);

  // Hide AdminShell header while on this page (body → header descendant selector works)
  useEffect(() => {
    document.body.classList.add("agents-canvas-active");
    return () => document.body.classList.remove("agents-canvas-active");
  }, []);

  // Center tree once after first data load (after React has committed the new DOM)
  useEffect(() => {
    if (tree && !hasCentered.current && canvasRef.current) {
      hasCentered.current = true;
      requestAnimationFrame(() => {
        if (canvasRef.current) centerTree(canvasRef.current, tree);
      });
    }
  }, [tree]);

  useEffect(() => {
    void fetchTree();
  }, []);

  function centerTree(canvasEl: HTMLDivElement, treeData: AgentNode) {
    const { width: cw, height: ch } = canvasEl.getBoundingClientRect();
    const childCount = treeData.children?.length ?? 1;
    const treeW = childCount * HORIZONTAL_SPACING;
    const treeH = VERTICAL_GAP + CHILD_SIZE + 32;

    const fitZoom = Math.min((cw - 80) / treeW, (ch - 100) / treeH, 1.2);
    const z = Math.max(0.3, Math.min(fitZoom, 1.5));
    setZoom(z);
    setPan({
      x: cw / 2,
      y: Math.max(60, (ch - treeH * z) / 2 + 24),
    });
  }

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
      setLogs((await res.json()) as AgentLog[]);
    } catch {
      setLogs([]);
    }
  }

  function handleAgentClick(agent: AgentNode) {
    setSelectedAgent(agent);
    void fetchLogs(agent.id);
    setTestResult(null);
  }

  async function handleTestAction(action: string) {
    setTestResult(`Exécution de "${action}"…`);
    try {
      const res = await fetch("/api/maestro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sitterId: "test",
          userId: "test",
          email: "test@example.com",
          applicationId: "test-123",
          date: new Date().toISOString().split("T")[0],
        }),
      });
      setTestResult(JSON.stringify(await res.json(), null, 2));
      void fetchTree();
      if (selectedAgent) void fetchLogs(selectedAgent.id);
    } catch (e) {
      setTestResult(`Erreur : ${(e as Error).message}`);
    }
  }

  const resetView = useCallback(() => {
    if (canvasRef.current && tree) centerTree(canvasRef.current, tree);
  }, [tree]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOrigin({ x: pan.x, y: pan.y });
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({ x: panOrigin.x + e.clientX - panStart.x, y: panOrigin.y + e.clientY - panStart.y });
    },
    [isPanning, panStart, panOrigin],
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  if (loading) return <AgentSkeleton />;

  return (
    <>
      <style>{fullscreenStyles}</style>

      {/* Toolbar */}
      <div
        className="fixed z-40 flex items-center justify-between px-5 py-2.5 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm"
        style={{ left: SIDEBAR_WIDTH, right: 0, top: 0 }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Bot size={18} className="text-violet-600" />
            Agents autonomes
          </h1>
          <span className="text-xs text-gray-400 hidden sm:inline select-none">
            Molette · zoom &nbsp;|&nbsp; Glisser · naviguer &nbsp;|&nbsp; Clic · détails
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-xs text-gray-400 mr-2 w-9 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Dézoomer"
          >
            <Minus size={14} className="text-gray-500" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Recentrer"
          >
            <Maximize2 size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Zoomer"
          >
            <Plus size={14} className="text-gray-500" />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1.5" />
          <button
            onClick={() => void fetchTree()}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Rafraîchir"
          >
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Infinite canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          top: 0,
          left: SIDEBAR_WIDTH,
          right: 0,
          bottom: 0,
          backgroundColor: "#f8fafc",
          cursor: isPanning ? "grabbing" : "grab",
        }}
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
              id="agentGrid"
              width={24}
              height={24}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x % 24},${pan.y % 24})`}
            >
              <circle cx={12} cy={12} r={1} fill="#cbd5e1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#agentGrid)" />
        </svg>

        {tree && (
          <AgentTreeCanvas
            tree={tree}
            zoom={zoom}
            pan={pan}
            selectedId={selectedAgent?.id ?? null}
            onSelect={handleAgentClick}
          />
        )}
      </div>

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
    </>
  );
}
