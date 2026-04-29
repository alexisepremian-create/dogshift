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

interface AgentLog {
  actionType: string;
  status: string;
  summary: string;
  durationMs?: number;
  createdAt: string;
}

// ─── Agent visual config ───
const COLORS = {
  maestro:       { icon: BrainCircuit, color: "#7c3aed", bg: "rgba(124,58,237,0.12)" },
  booking:       { icon: CalendarDays, color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  disponibilite: { icon: CalendarDays, color: "#059669", bg: "rgba(5,150,105,0.12)" },
  notification:  { icon: Sparkles,     color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  supervision:   { icon: Shield,       color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
} as const;

// ─── Layout constants ───
const SIDEBAR_WIDTH = 288;
const VERTICAL_GAP = 140;
const HORIZONTAL_SPACING = 180;
const MAESTRO_SIZE = 64;
const CHILD_SIZE = 50;

// ─── Agent circle ───
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
  const c = COLORS[agent.id as keyof typeof COLORS] || COLORS.maestro;
  const Icon = c.icon;
  const iconSize = size * 0.44;

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer select-none" onClick={onClick}>
      <div
        className="relative flex items-center justify-center rounded-full transition-[transform,box-shadow] duration-200 hover:scale-105"
        style={{
          width: size,
          height: size,
          backgroundColor: isSelected ? c.color : c.bg,
          boxShadow: isSelected
            ? `0 0 0 3px white, 0 0 0 5px ${c.color}50, 0 4px 16px ${c.color}30`
            : `0 2px 8px rgba(0,0,0,0.08)`,
        }}
      >
        <Icon size={iconSize} style={{ color: isSelected ? "white" : c.color }} />
        {agent.status === "online" && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
            style={{ backgroundColor: "#22c55e", animation: "pulse 2s ease-in-out infinite" }}
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

// ─── Bezier curve path ───
function BezierLine({
  x1, y1, x2, y2, color = "#94a3b8",
}: {
  x1: number; y1: number; x2: number; y2: number; color?: string;
}) {
  const midY = (y1 + y2) / 2;
  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeOpacity={0.35}
      strokeLinecap="round"
    />
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
  logs: AgentLog[];
  onClose: () => void;
  onTestAction: (action: string) => void;
  testResult: string | null;
}) {
  const c = COLORS[agent.id as keyof typeof COLORS] || COLORS.maestro;
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
            <span className="text-gray-600 font-medium">{agent.status === "online" ? "En ligne" : "Hors ligne"}</span>
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
                    style={{
                      backgroundColor: c.bg,
                      borderColor: `${c.color}30`,
                      color: c.color,
                    }}
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

// ─── Tree renderer ───
// All positions use a single coordinate system:
//   Maestro circle center = (0, MAESTRO_SIZE/2) in tree coords
//   Child i circle center = (childCx, VERTICAL_GAP + CHILD_SIZE/2)
// Lines connect maestro circle bottom → child circle top via bezier.
// SVG uses overflow:visible so it doesn't need to match the bounding box.
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
      {/*
        SVG at tree origin (0,0) with overflow:visible.
        Lines: from maestro bottom (0, MAESTRO_SIZE) to child top (childCx, VERTICAL_GAP).
      */}
      <svg
        width={0}
        height={0}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {children.map((child, i) => {
          const c = COLORS[child.id as keyof typeof COLORS];
          return (
            <BezierLine
              key={child.id}
              x1={0}
              y1={MAESTRO_SIZE}
              x2={childPositions[i].cx}
              y2={VERTICAL_GAP}
              color={c?.color || "#94a3b8"}
            />
          );
        })}
      </svg>

      {/* Maestro — div left edge at -MAESTRO_SIZE/2 so circle center sits at x=0 */}
      <div style={{ position: "absolute", left: -MAESTRO_SIZE / 2, top: 0 }}>
        <AgentCircle
          agent={tree}
          isSelected={selectedId === "maestro"}
          onClick={() => onSelect(tree)}
          size={MAESTRO_SIZE}
        />
      </div>

      {/* Children — div left edge at cx - CHILD_SIZE/2 so circle center sits at cx */}
      {children.map((child, i) => (
        <div
          key={child.id}
          style={{
            position: "absolute",
            left: childPositions[i].cx - CHILD_SIZE / 2,
            top: childPositions[i].cy,
          }}
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

// ─── Skeleton ───
function AgentSkeleton() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="w-24 h-3.5 bg-gray-200 rounded" />
        <div className="flex gap-12 mt-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gray-100 rounded-full" />
              <div className="w-20 h-3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// CSS targets body.agents-canvas-active (set via useEffect) so it can reach
// AdminShell's <header> which is an ancestor of the agents div, not a descendant.
const fullscreenStyles = `
  body.agents-canvas-active header {
    display: none !important;
  }
  body.agents-canvas-active main {
    padding: 0 !important;
    overflow: hidden !important;
  }
`;

// ─── Main page ───
export default function AgentsDashboard() {
  const [tree, setTree] = useState<AgentNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const hasCentered = useRef(false);

  // Add class to body so fullscreenStyles can target AdminShell's <header>
  // (which is an ancestor, not a descendant — CSS descendant selectors can't reach it otherwise)
  useEffect(() => {
    document.body.classList.add('agents-canvas-active');
    return () => document.body.classList.remove('agents-canvas-active');
  }, []);

  function centerTree(canvasEl: HTMLDivElement, treeData: AgentNode) {
    const rect = canvasEl.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    if (cw === 0 || ch === 0) return;

    const childCount = treeData.children?.length || 1;
    const totalWidth = childCount * HORIZONTAL_SPACING;
    const treeVisualWidth = totalWidth + HORIZONTAL_SPACING;
    const treeVisualHeight = VERTICAL_GAP + CHILD_SIZE + 60;

    const fitZoom = Math.min(
      (cw - 80) / treeVisualWidth,
      (ch - 100) / treeVisualHeight,
      1.4
    );
    const z = Math.max(0.3, Math.min(fitZoom, 1.4));

    // Vertical midpoint between maestro circle center and child circle center
    const treeCenterY = (MAESTRO_SIZE / 2 + VERTICAL_GAP + CHILD_SIZE / 2) / 2;

    setZoom(z);
    setPan({
      x: cw / 2,                         // maestro at x=0 → center horizontally
      y: ch / 2 - treeCenterY * z,        // center tree vertically
    });
  }

  // Center once after the tree is first rendered
  useEffect(() => {
    if (!tree || hasCentered.current) return;
    const el = canvasRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (el && tree) {
        centerTree(el, tree);
        hasCentered.current = true;
      }
    });
  }, [tree]);

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
    } catch {
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

  const resetView = useCallback(() => {
    if (canvasRef.current && tree) centerTree(canvasRef.current, tree);
  }, [tree]);

  // ─── Canvas interactions ───
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.2, Math.min(3, z - e.deltaY * 0.001)));
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
      setPan({ x: panOrigin.x + e.clientX - panStart.x, y: panOrigin.y + e.clientY - panStart.y });
    },
    [isPanning, panStart, panOrigin]
  );

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  if (loading) return <AgentSkeleton />;

  return (
    <div style={{ height: "100%" }}>
      <style>{fullscreenStyles}</style>

      {/* Floating toolbar */}
      <div
        className="fixed z-40 flex items-center justify-between px-6 py-3"
        style={{ left: SIDEBAR_WIDTH, right: 0, top: 0 }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bot size={20} className="text-violet-600" />
            Agents
          </h1>
          <span className="text-xs text-gray-400 hidden sm:inline">Molette zoom · Glisser naviguer</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1 w-8 text-right">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Zoom arrière"
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
            title="Zoom avant"
          >
            <Plus size={14} className="text-gray-500" />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={() => { hasCentered.current = false; fetchTree(); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Rafraîchir"
          >
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0 overflow-hidden bg-white"
        style={{
          left: SIDEBAR_WIDTH,
          cursor: isPanning ? "grabbing" : "grab",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Dot grid background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.35 }}
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
