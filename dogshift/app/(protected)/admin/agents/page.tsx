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
  Mail,
  UserPlus,
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

interface ExtendedLog {
  id: string;
  actionType: string;
  summary: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
  details: unknown;
}

interface StatsData {
  executions24h: number;
  errors24h: number;
  successRate7d: number | null;
  avgDuration7d: number | null;
  volumePerDay: { date: string; count: number }[];
  peakHour: number | null;
  total7d: number;
  lastExecution: { createdAt: string; durationMs: number | null; status: string } | null;
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
  "lead-magnet":              { icon: Mail,          color: "#db2777", bg: "#fdf2f8" },
  "onboarding-owner":         { icon: UserPlus,      color: "#0284c7", bg: "#f0f9ff" },
  "zootherapie-evaluation":   { icon: Sparkles,      color: "#7c3aed", bg: "#f5f3ff" },
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
const FREE_CX        = [-400, -300, -200, -100, 0, 100, 200, 300, 400] as const;
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
  { id: "lead-magnet",        name: "Lead Magnet",   description: "Capture emails & guide dogsitter",   icon: "Mail" },
  { id: "onboarding-owner",        name: "Onboarding",    description: "Accueil des nouveaux propriétaires", icon: "UserPlus" },
  { id: "zootherapie-evaluation",  name: "Zoothérapie",   description: "Évaluation bien-être IA par Claude", icon: "Sparkles" },
  { id: "booking",            name: "Booking",       description: "Gestion des réservations",           icon: "CalendarCheck" },
  { id: "candidature",        name: "Candidature",   description: "Wrapper enrichi (score + IA)",       icon: "SearchCheck" },
  { id: "notifications",      name: "Notifications", description: "Système de communication",           icon: "BellRing" },
  { id: "candidature_classic",name: "Score classique",description: "Algorithme par règles",             icon: "Calculator" },
  { id: "candidature_ai",     name: "Analyse IA",    description: "Claude qualitatif",                  icon: "Brain" },
];

// Zone membership
const FREE_AGENTS          = ["auth", "reservations", "calendrier", "contrat", "activation", "assistant", "lead-magnet", "onboarding-owner", "zootherapie-evaluation"] as const;
const MAESTRO_CHILDREN     = ["booking", "candidature", "notifications"] as const;
const CANDIDATURE_CHILDREN = ["candidature_classic", "candidature_ai"] as const;

// Build lookup: id → AgentNode (static node for rendering — status comes from health polling)
function agentDefToNode(def: AgentDef): AgentNode {
  return { id: def.id, name: def.name, emoji: "", description: def.description, status: "online" };
}
const AGENT_MAP: Record<string, AgentNode> = Object.fromEntries(
  AGENTS.map((a) => [a.id, agentDefToNode(a)])
);

// ─── Health status ─────────────────────────────────────────────────────────────

type AgentHealthStatus = "online" | "offline" | "unknown" | "loading";

const STATUS_DOT_COLOR: Record<AgentHealthStatus, string> = {
  online:  "#16a34a",
  offline: "#dc2626",
  unknown: "#9ca3af",
  loading: "#f59e0b",
};

/** Comma-separated list of all agent IDs sent as query param to the health endpoint. */
const ALL_AGENT_IDS = AGENTS.map((a) => a.id).join(",");

/** Initial statuses: all agents start as "loading" until the first health fetch resolves. */
const INITIAL_STATUSES: Record<string, AgentHealthStatus> = Object.fromEntries(
  AGENTS.map((a) => [a.id, "loading" as AgentHealthStatus])
);

// ─── Agent circle ─────────────────────────────────────────────────────────────

function AgentCircle({
  agent,
  isSelected,
  onClick,
  size = 50,
  status = "unknown",
}: {
  agent: AgentNode;
  isSelected: boolean;
  onClick: () => void;
  size?: number;
  status?: AgentHealthStatus;
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
        {/* Health-status dot — always visible, color reflects real liveness */}
        <span
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{
            backgroundColor: STATUS_DOT_COLOR[status],
            animation: "agentPulse 2s ease-in-out infinite",
          }}
        />
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

// ─── Drawer helpers ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)}h`;
  return `il y a ${Math.floor(diff / 86_400_000)}j`;
}

const AGENT_ROUTES: Record<string, string> = {
  maestro:                  "/api/maestro",
  "lead-magnet":            "/api/agents/lead-magnet",
  "onboarding-owner":       "/api/agents/onboarding-owner",
  "zootherapie-evaluation": "/api/agents/zootherapie-evaluation",
  candidature:              "/api/agents/candidature-enriched",
  candidature_classic:      "/api/agents/candidature",
  candidature_ai:           "/api/agents/candidature-ai-review",
  booking:                  "/api/agents/booking",
  notifications:            "/api/agents/notification",
  calendrier:               "/api/agents/calendrier",
  contrat:                  "/api/agents/contrat",
  activation:               "/api/agents/activation",
};

const DEFAULT_BODIES: Record<string, object> = {
  maestro:                  { action: "lead_magnet_captured", email: "test@example.com" },
  "lead-magnet":            { email: "test@example.com", prenom: "Test", source: "test" },
  "onboarding-owner":       { email: "test@example.com", prenom: "Test", userId: "user_test" },
  "zootherapie-evaluation": {
    prenom: "Test",
    email: "test@example.com",
    reponses: { q1: "1 à 3h", q2: "Apaisé(e)", q3: "Toujours", q4: "Oui, beaucoup", q5: "Pet-sitter professionnel" },
  },
  candidature:              { nom: "Test User", email: "test@example.com", sitterId: "test-id" },
  candidature_classic:      { nom: "Test", email: "test@example.com", ville: "Lausanne", experience: "3 ans" },
  candidature_ai:           { nom: "Test", email: "test@example.com", ville: "Lausanne", experience: "3 ans", message: "Passionné par les animaux." },
  booking:                  { userId: "user_test", sitterId: "sitter_test", startDate: "2026-06-01", serviceType: "PENSION" },
};

function Sparkline({ data }: { data: { date: string; count: number }[] }) {
  const values = data.map((d) => d.count);
  const max = Math.max(...values, 1);
  const W = 260;
  const H = 36;
  const pts = values
    .map((v, i) => {
      const x = values.length < 2 ? W / 2 : (i / (values.length - 1)) * W;
      const y = H - (v / max) * (H - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPoints = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkGrad)" />
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-20 w-full">
      {data.map(({ date, count }) => (
        <div key={date} className="flex flex-1 flex-col items-center gap-0.5 min-w-0">
          <div
            className="w-full rounded-t bg-indigo-400 transition-all"
            style={{ height: `${Math.round((count / max) * 52)}px`, minHeight: count > 0 ? 3 : 0 }}
            title={`${date}: ${count}`}
          />
          <span className="text-[9px] text-gray-400 truncate w-full text-center">
            {date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Agent Drawer ─────────────────────────────────────────────────────────────

function santeGlobale(rate: number | null): { color: string; label: string; bg: string } {
  if (rate == null) return { color: "#9ca3af", label: "Inconnu",  bg: "#f3f4f6" };
  if (rate >= 95)   return { color: "#16a34a", label: "Excellent", bg: "#f0fdf4" };
  if (rate >= 80)   return { color: "#f59e0b", label: "Correct",   bg: "#fffbeb" };
  return               { color: "#dc2626", label: "Dégradé",  bg: "#fef2f2" };
}

function AgentDrawer({
  agent,
  logs,
  onClose,
  onTestAction,
  testResult,
  status = "unknown",
}: {
  agent: AgentNode;
  logs: AgentLog[];
  onClose: () => void;
  onTestAction: (action: string) => void;
  testResult: string | null;
  status?: AgentHealthStatus;
}) {
  const c = getColor(agent.id);
  const Icon = c.icon;

  // ── Slide-in animation ────────────────────────────────────────────────────
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  type DrawerTab = "vue" | "logs" | "stats" | "tester";
  const [tab, setTab] = useState<DrawerTab>("vue");
  const [isLive, setIsLive] = useState(false);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<StatsData | null>(null);
  useEffect(() => {
    fetch(`/api/admin/agents/${agent.id}/stats`)
      .then((r) => r.json())
      .then((d: StatsData) => setStats(d))
      .catch(() => {});
  }, [agent.id]);

  // ── Logs tab ──────────────────────────────────────────────────────────────
  const [modalLogs, setModalLogs] = useState<ExtendedLog[]>([]);
  const [logsPage, setLogsPage] = useState(0);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [logsFilter, setLogsFilter] = useState<"all" | "error">("all");
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchModalLogs = useCallback(
    async (page: number, filter: "all" | "error", reset: boolean) => {
      setLogsLoading(true);
      try {
        const res = await fetch(`/api/admin/agents/${agent.id}/logs?page=${page}&filter=${filter}`);
        const data = (await res.json()) as { logs: ExtendedLog[]; hasMore: boolean };
        setModalLogs((prev) => (reset ? data.logs : [...prev, ...data.logs]));
        setLogsPage(page);
        setLogsHasMore(data.hasMore);
      } catch {
        // silently ignore
      } finally {
        setLogsLoading(false);
      }
    },
    [agent.id]
  );

  // Initial load + live 5 s polling when Logs tab is active
  useEffect(() => {
    if (tab !== "logs") { setIsLive(false); return; }
    void fetchModalLogs(0, logsFilter, true);
    setIsLive(true);
    const interval = setInterval(() => void fetchModalLogs(0, logsFilter, true), 5_000);
    return () => { clearInterval(interval); setIsLive(false); };
  }, [tab, logsFilter, fetchModalLogs]);

  // ── Tester tab ────────────────────────────────────────────────────────────
  const [testerBody, setTesterBody] = useState(JSON.stringify(DEFAULT_BODIES[agent.id] ?? {}, null, 2));
  const [testerResult, setTesterResult] = useState<string | null>(null);
  const [testerTime, setTesterTime] = useState<number | null>(null);
  const [testerLoading, setTesterLoading] = useState(false);
  const [testerIsError, setTesterIsError] = useState(false);

  async function handleTesterRun() {
    const route = AGENT_ROUTES[agent.id];
    if (!route) { setTesterResult("Aucune route configurée pour cet agent."); return; }
    let body: object = {};
    try { body = JSON.parse(testerBody) as object; } catch { setTesterResult("JSON invalide."); return; }
    setTesterLoading(true);
    setTesterResult(null);
    setTesterIsError(false);
    const t0 = Date.now();
    try {
      const res = await fetch(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      setTesterResult(JSON.stringify(json, null, 2));
      setTesterIsError(!res.ok);
    } catch (e) {
      setTesterResult(`Erreur réseau : ${(e as Error).message}`);
      setTesterIsError(true);
    } finally {
      setTesterTime(Date.now() - t0);
      setTesterLoading(false);
    }
  }

  const TABS: { id: DrawerTab; label: string }[] = [
    { id: "vue",    label: "Vue"    },
    { id: "logs",   label: "Logs"   },
    { id: "stats",  label: "Stats"  },
    { id: "tester", label: "Tester" },
  ];

  const sante = santeGlobale(stats?.successRate7d ?? null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ pointerEvents: "none" }}>
      {/* ── Backdrop ── */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          pointerEvents: "auto",
          backgroundColor: visible ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0)",
          backdropFilter: visible ? "blur(2px)" : "none",
        }}
        onClick={handleClose}
      />

      {/* ── Drawer panel ── */}
      <div
        className="relative flex flex-col bg-white shadow-2xl w-full md:w-[480px] transition-transform duration-300 ease-out"
        style={{
          pointerEvents: "auto",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          height: "100dvh",
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 44, height: 44, backgroundColor: c.bg }}
              >
                <Icon size={20} style={{ color: c.color }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900 truncate">{agent.name}</h2>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_DOT_COLOR[status], animation: "agentPulse 2s ease-in-out infinite" }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">{agent.id}</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition flex-shrink-0 ml-2">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{agent.description}</p>
        </div>

        {/* Tab bar */}
        <div className="flex-shrink-0 flex gap-0.5 px-5 pt-2.5 pb-2 border-b border-gray-100 bg-gray-50/50">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
              }`}
            >
              {label}
              {id === "logs" && isLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="En direct" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content — fills remaining height, scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">

          {/* ────────── TAB: VUE ────────── */}
          {tab === "vue" && (
            <div className="space-y-4">
              {/* Status row */}
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_DOT_COLOR[status] }} />
                <span className="text-gray-600 font-medium">
                  {status === "online" ? "En ligne" : status === "offline" ? "Hors ligne" : status === "loading" ? "Vérification…" : "Inconnu"}
                </span>
                {stats?.lastExecution && (
                  <span className="text-gray-400 text-xs ml-auto flex items-center gap-1">
                    <Clock size={12} />
                    {timeAgo(stats.lastExecution.createdAt)}
                    {stats.lastExecution.durationMs != null && (
                      <span className="ml-1 text-gray-300">· {stats.lastExecution.durationMs}ms</span>
                    )}
                  </span>
                )}
              </div>

              {/* 24h counters */}
              {stats && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  <Activity size={11} className="text-gray-400" />
                  <span>
                    <span className="font-medium text-gray-700">{stats.executions24h}</span>{" "}exécutions aujourd&apos;hui
                  </span>
                  {stats.errors24h > 0 && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-red-500 font-medium">{stats.errors24h} erreur{stats.errors24h > 1 ? "s" : ""}</span>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
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

              {/* Test result from parent onTestAction */}
              {testResult && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Résultat</h4>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-gray-700">
                    {testResult}
                  </pre>
                </div>
              )}

              {/* Recent activity (last 4 from parent-passed logs) */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity size={12} /> Activité récente
                </h4>
                <div className="space-y-1.5">
                  {logs.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Aucune action pour l&apos;instant</p>
                  ) : (
                    logs.slice(0, 4).map((log, i) => (
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
                        <p className="text-gray-400 mt-0.5 ml-6 text-[10px]">{timeAgo(log.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ────────── TAB: LOGS — n8n-style timeline ────────── */}
          {tab === "logs" && (
            <div className="space-y-3">
              {/* Header row: filter + live indicator */}
              <div className="flex items-center gap-2">
                {(["all", "error"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setLogsFilter(f); setLogsPage(0); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      logsFilter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {f === "all" ? "Tous" : "Erreurs"}
                  </button>
                ))}
                {isLive && (
                  <span className="ml-auto flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    En direct
                  </span>
                )}
              </div>

              {logsLoading && modalLogs.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Chargement…</p>
              ) : modalLogs.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-6 text-center">Aucun log trouvé</p>
              ) : (
                <div className="relative">
                  {/* Vertical timeline spine */}
                  <div className="absolute left-[11px] top-0 bottom-0 w-px bg-gray-100" />

                  {modalLogs.map((log) => {
                    const dotColor = log.status === "success" ? "#22c55e" : log.status === "error" ? "#ef4444" : "#eab308";
                    const isExpanded = expandedLog === log.id;
                    return (
                      <div key={log.id} className="relative pl-8 pb-3">
                        {/* Timeline dot */}
                        <div
                          className="absolute left-1.5 top-3 w-2.5 h-2.5 rounded-full border-2 border-white z-10"
                          style={{ backgroundColor: dotColor }}
                        />
                        {/* Row card */}
                        <button
                          className="w-full text-left rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors px-3 py-2"
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-800 truncate flex-1">{log.actionType}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {log.durationMs != null && (
                                <span className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 font-mono">
                                  {log.durationMs}ms
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400">{timeAgo(log.createdAt)}</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            {log.summary.length > 60 ? log.summary.slice(0, 60) + "…" : log.summary}
                          </p>
                        </button>

                        {/* Expanded detail panel */}
                        {isExpanded && (
                          <div className="mt-1.5 rounded-lg border border-gray-200 bg-white overflow-hidden text-[11px]">
                            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                              <span className="font-semibold text-[10px] text-gray-500 uppercase tracking-wider">Détails d&apos;exécution</span>
                            </div>
                            <pre className="px-3 py-2.5 overflow-auto max-h-52 font-mono text-gray-700 whitespace-pre-wrap text-[11px]">
                              {log.details ? JSON.stringify(log.details, null, 2) : "— aucun détail —"}
                            </pre>
                            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-500">
                              <span>Durée : {log.durationMs != null ? `${log.durationMs}ms` : "—"}</span>
                              <span className="text-gray-300">·</span>
                              <span style={{ color: dotColor }}>
                                {log.status === "success" ? "✓ Succès" : log.status === "error" ? "✗ Erreur" : "~ Inconnu"}
                              </span>
                              <span className="text-gray-300">·</span>
                              <span>{new Date(log.createdAt).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "medium" })}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {logsHasMore && (
                <button
                  onClick={() => void fetchModalLogs(logsPage + 1, logsFilter, false)}
                  disabled={logsLoading}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {logsLoading ? "Chargement…" : "Voir plus"}
                </button>
              )}
            </div>
          )}

          {/* ────────── TAB: STATS ────────── */}
          {tab === "stats" && (
            <div className="space-y-5">
              {!stats ? (
                <p className="text-xs text-gray-400 py-6 text-center">Chargement…</p>
              ) : (
                <>
                  {/* Santé globale */}
                  <div
                    className="flex items-center gap-3 rounded-xl border px-4 py-3"
                    style={{ backgroundColor: sante.bg, borderColor: sante.color + "30" }}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sante.color }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: sante.color }}>Santé globale : {sante.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {stats.successRate7d != null ? `${stats.successRate7d}% de succès sur 7 jours` : "Aucune donnée disponible"}
                      </p>
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Succès 7j</p>
                      <p className="text-xl font-bold text-gray-900">
                        {stats.successRate7d != null ? `${stats.successRate7d}%` : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Moy. durée</p>
                      <p className="text-xl font-bold text-gray-900">
                        {stats.avgDuration7d != null ? `${stats.avgDuration7d}ms` : "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Total 7j</p>
                      <p className="text-xl font-bold text-gray-900">{stats.total7d}</p>
                    </div>
                  </div>

                  {/* Sparkline */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activité 7 jours</h4>
                      {stats.peakHour != null && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded px-2 py-0.5">
                          Pic {stats.peakHour}h–{stats.peakHour + 1}h
                        </span>
                      )}
                    </div>
                    {stats.volumePerDay.length > 1 ? (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 pt-3 pb-1 overflow-hidden">
                        <Sparkline data={stats.volumePerDay} />
                        <div className="flex justify-between mt-1">
                          <span className="text-[9px] text-gray-300">{stats.volumePerDay[0]?.date.slice(5)}</span>
                          <span className="text-[9px] text-gray-300">{stats.volumePerDay[stats.volumePerDay.length - 1]?.date.slice(5)}</span>
                        </div>
                      </div>
                    ) : stats.volumePerDay.length === 1 ? (
                      <p className="text-xs text-gray-400 italic">1 jour de données — pas assez pour tracer</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Pas de données</p>
                    )}
                  </div>

                  {/* Bar chart (daily breakdown) */}
                  {stats.volumePerDay.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Volume / jour</h4>
                      <BarChart data={stats.volumePerDay} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ────────── TAB: TESTER ────────── */}
          {tab === "tester" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Corps de la requête (JSON)
                </label>
                <textarea
                  value={testerBody}
                  onChange={(e) => setTesterBody(e.target.value)}
                  rows={9}
                  className="w-full text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 resize-none"
                  spellCheck={false}
                />
              </div>

              <button
                onClick={() => void handleTesterRun()}
                disabled={testerLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: testerLoading ? "#6b7280" : c.color }}
              >
                {testerLoading ? (
                  <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Exécution…</>
                ) : (
                  <><Zap size={12} />Exécuter</>
                )}
              </button>

              {testerResult && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${testerIsError ? "text-red-500" : "text-green-600"}`}>
                      {testerIsError ? "Erreur" : "Réponse"}
                    </span>
                    {testerTime != null && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock size={10} /> {testerTime}ms
                      </span>
                    )}
                  </div>
                  <pre className={`text-xs p-3 rounded-lg border overflow-auto max-h-52 whitespace-pre-wrap font-mono ${
                    testerIsError ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}>
                    {testerResult}
                  </pre>
                </div>
              )}

              {!AGENT_ROUTES[agent.id] && (
                <p className="text-xs text-gray-400 italic text-center">Aucune route directe configurée pour cet agent.</p>
              )}
            </div>
          )}
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
  statuses,
}: {
  zoom: number;
  pan: { x: number; y: number };
  selectedId: string | null;
  onSelect: (agent: AgentNode) => void;
  statuses: Record<string, AgentHealthStatus>;
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
          <div key={id} style={{ position: "absolute", left: FREE_CX[i], top: Y_FREE, transform: "translateX(-50%)" }}>
            <AgentCircle
              agent={agent}
              isSelected={selectedId === id}
              onClick={() => onSelect(agent)}
              size={CHILD_SIZE}
              status={statuses[id] ?? "loading"}
            />
          </div>
        );
      })}

      {/* ── Zone 2 : Maestro ── */}
      <div style={{ position: "absolute", left: MAESTRO_CX, top: Y_MAESTRO, transform: "translateX(-50%)" }}>
        <AgentCircle
          agent={AGENT_MAP["maestro"]!}
          isSelected={selectedId === "maestro"}
          onClick={() => onSelect(AGENT_MAP["maestro"]!)}
          size={MAESTRO_SIZE}
          status={statuses["maestro"] ?? "loading"}
        />
      </div>

      {/* ── Zone 3 : enfants de Maestro ── */}
      {MAESTRO_CHILDREN.map((id, i) => {
        const agent = AGENT_MAP[id];
        if (!agent) return null;
        return (
          <div key={id} style={{ position: "absolute", left: MAESTRO_CHILDREN_CX[i], top: Y_MAESTRO_CHILDREN, transform: "translateX(-50%)" }}>
            <AgentCircle
              agent={agent}
              isSelected={selectedId === id}
              onClick={() => onSelect(agent)}
              size={CHILD_SIZE}
              status={statuses[id] ?? "loading"}
            />
          </div>
        );
      })}

      {/* ── Zone 4 : sous-enfants de Candidature ── */}
      {CANDIDATURE_CHILDREN.map((id, i) => {
        const agent = AGENT_MAP[id];
        if (!agent) return null;
        return (
          <div key={id} style={{ position: "absolute", left: CANDIDATURE_CHILDREN_CX[i], top: Y_CANDIDATURE_CHILDREN, transform: "translateX(-50%)" }}>
            <AgentCircle
              agent={agent}
              isSelected={selectedId === id}
              onClick={() => onSelect(agent)}
              size={CHILD_SIZE}
              status={statuses[id] ?? "loading"}
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
  @media (min-width: 768px) {
    .drawer-canvas-shift  { transition: right 300ms ease-out; }
    .drawer-canvas-shift.drawer-open { right: 480px !important; }
  }
`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsDashboard() {
  const [loading, setLoading] = useState(true);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentHealthStatus>>(INITIAL_STATUSES);
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

  // ── Health polling ──────────────────────────────────────────────────────────

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/agents-health?ids=${ALL_AGENT_IDS}`);
      if (res.ok) {
        const data = (await res.json()) as { results: Record<string, "online" | "offline" | "unknown"> };
        setAgentStatuses((prev) => ({ ...prev, ...data.results }));
      }
    } catch {
      // Network errors silently ignored — statuses keep their last known value
    } finally {
      // Move out of global "loading" after the very first attempt (success or not)
      setLoading((prev) => (prev ? false : prev));
    }
  }, []);

  // Immediate fetch on mount + 30 s polling interval
  useEffect(() => {
    void fetchStatuses();
    const interval = setInterval(() => void fetchStatuses(), 30_000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

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
      void fetchStatuses();
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
        className={`fixed z-40 flex items-center justify-between px-5 py-2.5 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm drawer-canvas-shift${selectedAgent ? " drawer-open" : ""}`}
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
            onClick={() => void fetchStatuses()}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Rafraîchir le statut des agents"
          >
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Infinite canvas */}
      <div
        ref={canvasRef}
        className={`absolute inset-0 overflow-hidden drawer-canvas-shift${selectedAgent ? " drawer-open" : ""}`}
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
          statuses={agentStatuses}
        />
      </div>

      {selectedAgent && (
        <AgentDrawer
          agent={selectedAgent}
          logs={logs}
          testResult={testResult}
          status={agentStatuses[selectedAgent.id] ?? "unknown"}
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
