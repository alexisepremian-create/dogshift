'use client';

import { type ElementType, useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  Brain,
  BrainCircuit,
  Sparkles,
  CalendarDays,
  CalendarCheck,
  Calculator,
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

interface AgentLog {
  status: string;
  actionType: string;
  summary: string;
  durationMs?: number;
  createdAt: string;
}

interface AgentDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// ─── Color config ─────────────────────────────────────────────────────────────

const COLORS: Record<string, { icon: ElementType; color: string; bg: string }> = {
  maestro:             { icon: BrainCircuit,  color: "#4f46e5", bg: "#eef2ff" },
  auth:                { icon: Shield,        color: "#2563eb", bg: "#eff6ff" },
  reservations:        { icon: Bot,           color: "#ea580c", bg: "#fff7ed" },
  calendrier:          { icon: CalendarDays,  color: "#e11d48", bg: "#fff1f2" },
  contrat:             { icon: FileText,      color: "#8b5cf6", bg: "#f5f3ff" },
  activation:          { icon: UserCheck,     color: "#16a34a", bg: "#f0fdf4" },
  assistant:           { icon: Sparkles,      color: "#4338ca", bg: "#eef2ff" },
  booking:             { icon: CalendarCheck, color: "#0d9488", bg: "#f0fdfa" },
  candidature:         { icon: SearchCheck,   color: "#0891b2", bg: "#ecfeff" },
  notifications:       { icon: BellRing,      color: "#dc2626", bg: "#fef2f2" },
  candidature_classic: { icon: Calculator,    color: "#475569", bg: "#f8fafc" },
  candidature_ai:      { icon: Brain,         color: "#d97706", bg: "#fffbeb" },
};

const DEFAULT_COLOR = { icon: Bot, color: "#64748b", bg: "rgba(100,116,139,0.12)" };

function getColor(id: string) {
  return COLORS[id] ?? DEFAULT_COLOR;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 288;
const MAESTRO_SIZE = 64;
const CHILD_SIZE = 48;

// Y positions (top edge of each circle row)
const Y_FREE               = 100;
const Y_MAESTRO            = 280;
const Y_MAESTRO_CHILDREN   = 460;
const Y_CANDIDATURE_CHILDREN = 640;

// X centers for each row
const FREE_CX        = [-350, -210, -70, 70, 210, 350] as const;
const MAESTRO_CX     = 0;
const MAESTRO_CHILDREN_CX = [-200, 0, 200] as const;
const CANDIDATURE_CX = 0; // candidature is index 1 of MAESTRO_CHILDREN → cx=0
const CANDIDATURE_CHILDREN_CX = [-110, 110] as const;

// ─── Static agent definitions ─────────────────────────────────────────────────

const AGENTS: AgentDef[] = [
  { id: "maestro",            name: "Maestro",       description: "Orchestrateur central",              icon: "BrainCircuit" },
  { id: "auth",               name: "Auth",          description: "Gestion des accès",                  icon: "Shield" },
  { id: "reservations",       name: "Réservations",  description: "Gestion des bookings",               icon: "Bot" },
  { id: "calendrier",         name: "Calendrier",    description: "Gère les rendez-vous Cal.com",       icon: "CalendarDays" },
  { id: "contrat",            name: "Contrat",       description: "Signatures électroniques",           icon: "FileText" },
  { id: "activation",         name: "Activation",    description: "Onboarding pet-sitters",             icon: "UserCheck" },
  { id: "assistant",          name: "Assistant IA",  description: "Support utilisateur",                icon: "Sparkles" },
  { id: "booking",            name: "Booking",       description: "Gestion des réservations",           icon: "CalendarCheck" },
  { id: "candidature",        name: "Candidature",   description: "Wrapper enrichi (score + IA)",       icon: "SearchCheck" },
  { id: "notifications",      name: "Notifications", description: "Système de communication",           icon: "BellRing" },
  { id: "candidature_classic",name: "Score classique",description: "Algorithme par règles",             icon: "Calculator" },
  { id: "candidature_ai",     name: "Analyse IA",    description: "Claude qualitatif",                  icon: "Brain" },
];

// Zone membership
const FREE_AGENTS          = ["auth", "reservations", "calendrier", "contrat", "activation", "assistant"] as const;
const MAESTRO_CHILDREN     = ["booking", "candidature", "notifications"] as const;
const CANDIDATURE_CHILDREN = ["candidature_classic", "candidature_ai"] as const;

// Build lookup: id → AgentNode (static fake node for rendering)
function agentDefToNode(def: AgentDef): AgentNode {
  return { id: def.id, name: def.name, emoji: "", description: def.description, status: "online" };
}
const AGENT_MAP: Record<string, AgentNode> = Object.fromEntries(
  AGENTS.map((a) => [a.id, agentDefToNode(a)])
);

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

// ─── Hierarchy canvas ─────────────────────────────────────────────────────────

function HierarchyCanvas({
  zoom,
  pan,
  selectedId,
  onSelect,
}: {
  zoom: number;
  pan: { x: number; y: number };
  selectedId: string | null;
  onSelect: (agent: AgentNode) => void;
}) {
  // Centers (Y) for Bezier control points
  const maestroCY    = Y_MAESTRO            + MAESTRO_SIZE / 2;
  const childCY      = Y_MAESTRO_CHILDREN   + CHILD_SIZE  / 2;
  const grandchildCY = Y_CANDIDATURE_CHILDREN + CHILD_SIZE / 2;
  const midY1 = (maestroCY + childCY)      / 2;
  const midY2 = (childCY   + grandchildCY) / 2;

  // SVG spans x ∈ [-600, 600], y ∈ [0, 800] in container coords
  const svgLeft = -600;
  const svgTop  = 0;
  const svgW    = 1200;
  const svgH    = 800;
  // Translate so that container (0,0) maps to SVG (600, 0)
  const tx = -svgLeft; // 600
  const ty = -svgTop;  // 0

  return (
    <div
      className="absolute"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: "0 0",
      }}
    >
      {/* ── Bezier connection lines ── */}
      <svg
        style={{ position: "absolute", left: svgLeft, top: svgTop, width: svgW, height: svgH, pointerEvents: "none" }}
      >
        <g transform={`translate(${tx}, ${ty})`}>
          {/* Maestro → Maestro children */}
          {MAESTRO_CHILDREN.map((id, i) => {
            const cx = MAESTRO_CHILDREN_CX[i];
            return (
              <path
                key={id}
                d={`M ${MAESTRO_CX},${maestroCY} C ${MAESTRO_CX},${midY1} ${cx},${midY1} ${cx},${childCY}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
            );
          })}

          {/* Candidature → sub-children */}
          {CANDIDATURE_CHILDREN.map((id, i) => {
            const cx = CANDIDATURE_CHILDREN_CX[i];
            return (
              <path
                key={id}
                d={`M ${CANDIDATURE_CX},${childCY} C ${CANDIDATURE_CX},${midY2} ${cx},${midY2} ${cx},${grandchildCY}`}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
            );
          })}
        </g>
      </svg>

      {/* ── Zone 1 : électrons libres (aucune ligne) ── */}
      {FREE_AGENTS.map((id, i) => {
        const agent = AGENT_MAP[id];
        if (!agent) return null;
        return (
          <div key={id} style={{ position: "absolute", left: FREE_CX[i] - CHILD_SIZE / 2, top: Y_FREE }}>
            <AgentCircle
              agent={agent}
              isSelected={selectedId === id}
              onClick={() => onSelect(agent)}
              size={CHILD_SIZE}
            />
          </div>
        );
      })}

      {/* ── Zone 2 : Maestro ── */}
      <div style={{ position: "absolute", left: MAESTRO_CX - MAESTRO_SIZE / 2, top: Y_MAESTRO }}>
        <AgentCircle
          agent={AGENT_MAP["maestro"]!}
          isSelected={selectedId === "maestro"}
          onClick={() => onSelect(AGENT_MAP["maestro"]!)}
          size={MAESTRO_SIZE}
        />
      </div>

      {/* ── Zone 3 : enfants de Maestro ── */}
      {MAESTRO_CHILDREN.map((id, i) => {
        const agent = AGENT_MAP[id];
        if (!agent) return null;
        return (
          <div key={id} style={{ position: "absolute", left: MAESTRO_CHILDREN_CX[i] - CHILD_SIZE / 2, top: Y_MAESTRO_CHILDREN }}>
            <AgentCircle
              agent={agent}
              isSelected={selectedId === id}
              onClick={() => onSelect(agent)}
              size={CHILD_SIZE}
            />
          </div>
        );
      })}

      {/* ── Zone 4 : sous-enfants de Candidature ── */}
      {CANDIDATURE_CHILDREN.map((id, i) => {
        const agent = AGENT_MAP[id];
        if (!agent) return null;
        return (
          <div key={id} style={{ position: "absolute", left: CANDIDATURE_CHILDREN_CX[i] - CHILD_SIZE / 2, top: Y_CANDIDATURE_CHILDREN }}>
            <AgentCircle
              agent={agent}
              isSelected={selectedId === id}
              onClick={() => onSelect(agent)}
              size={CHILD_SIZE}
            />
          </div>
        );
      })}
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

  const centerTree = useCallback((canvasEl: HTMLDivElement) => {
    const { width: cw, height: ch } = canvasEl.getBoundingClientRect();
    const treeW = FREE_CX[FREE_CX.length - 1] * 2 + CHILD_SIZE + 80; // ~780px
    const treeH = Y_CANDIDATURE_CHILDREN + CHILD_SIZE + 80;           // ~776px
    const fitZoom = Math.min((cw - 80) / treeW, (ch - 80) / treeH, 1.2);
    const z = Math.max(0.3, Math.min(fitZoom, 1.5));
    setZoom(z);
    setPan({
      x: cw / 2,
      y: Math.max(60, (ch - treeH * z) / 2 + 24),
    });
  }, []);

  // Center once after loading completes (canvas is in the DOM)
  useEffect(() => {
    if (!hasCentered.current && !loading && canvasRef.current) {
      hasCentered.current = true;
      requestAnimationFrame(() => {
        if (canvasRef.current) centerTree(canvasRef.current);
      });
    }
  }, [loading, centerTree]);

  useEffect(() => {
    void fetchTree();
  }, []);

  async function fetchTree() {
    try {
      await fetch("/api/maestro");
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
    if (canvasRef.current) centerTree(canvasRef.current);
  }, [centerTree]);

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

        <HierarchyCanvas
          zoom={zoom}
          pan={pan}
          selectedId={selectedAgent?.id ?? null}
          onSelect={handleAgentClick}
        />
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
