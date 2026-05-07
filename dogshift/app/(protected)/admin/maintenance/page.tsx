"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Package,
  Clock,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackageResult {
  pkg: string;
  current: string;
  latest: string;
  status: "up_to_date" | "updated" | "pr_exists" | "ts_fix_failed" | "failed";
  prUrl?: string;
  isSensitive?: boolean;
  risk?: string;
  releases?: number;
  summary?: string;
}

interface MaintenanceLog {
  id: string;
  actionType: string;
  summary: string;
  status: string;
  createdAt: string;
  details?: {
    packages?: PackageResult[];
    durationMs?: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(status: string) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "warning" || status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function pkgStatusBadge(status: PackageResult["status"]) {
  const map: Record<string, { label: string; className: string }> = {
    updated: { label: "Mis à jour", className: "bg-emerald-100 text-emerald-700" },
    up_to_date: { label: "À jour", className: "bg-gray-100 text-gray-500" },
    pr_exists: { label: "PR ouverte", className: "bg-blue-100 text-blue-700" },
    ts_fix_failed: { label: "TS non résolu", className: "bg-amber-100 text-amber-700" },
    failed: { label: "Échec", className: "bg-red-100 text-red-700" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function riskBadge(risk?: string) {
  if (!risk || risk === "none") return null;
  const map: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[risk] ?? "bg-gray-100 text-gray-500"}`}>
      {risk}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

// ─── Components ───────────────────────────────────────────────────────────────

function LogRow({ log }: { log: MaintenanceLog }) {
  const [expanded, setExpanded] = useState(false);
  const packages = log.details?.packages ?? [];
  const durationMs = log.details?.durationMs;

  const updated = packages.filter(p => p.status === "updated");
  const failed = packages.filter(p => ["ts_fix_failed", "failed"].includes(p.status));
  const isWeekly = log.actionType === "weekly_report";

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors rounded-xl"
      >
        {statusIcon(log.status)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">{log.summary}</span>
            {isWeekly && (
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                Rapport hebdo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {timeAgo(log.createdAt)}
            </span>
            {durationMs !== undefined && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Zap className="h-3 w-3" />
                {Math.round(durationMs / 1000)}s
              </span>
            )}
            {packages.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Package className="h-3 w-3" />
                {packages.length} paquet{packages.length > 1 ? "s" : ""}
              </span>
            )}
            {updated.length > 0 && (
              <span className="text-xs text-emerald-600 font-medium">{updated.length} mis à jour</span>
            )}
            {failed.length > 0 && (
              <span className="text-xs text-red-600 font-medium">{failed.length} échec{failed.length > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        {packages.length > 0
          ? expanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
          : <div className="w-4" />
        }
      </button>

      {expanded && packages.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase">
                <th className="pb-2 text-left font-medium">Paquet</th>
                <th className="pb-2 text-left font-medium">Version</th>
                <th className="pb-2 text-left font-medium">Statut</th>
                {isWeekly && <th className="pb-2 text-left font-medium">Risque</th>}
                <th className="pb-2 text-left font-medium">Lien</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {packages.map((p, i) => (
                <tr key={i} className="text-gray-700">
                  <td className="py-1.5 font-mono text-xs font-medium">
                    {p.pkg}
                    {p.isSensitive && (
                      <span className="ml-1 text-amber-500">⚠</span>
                    )}
                  </td>
                  <td className="py-1.5 text-xs text-gray-500">
                    {p.current && p.latest && p.current !== p.latest
                      ? <>{p.current} <span className="text-gray-300">→</span> <span className="text-emerald-600 font-medium">{p.latest}</span></>
                      : p.current ?? p.latest ?? "—"}
                  </td>
                  <td className="py-1.5">{pkgStatusBadge(p.status)}</td>
                  {isWeekly && <td className="py-1.5">{riskBadge(p.risk)}</td>}
                  <td className="py-1.5">
                    {p.prUrl ? (
                      <a
                        href={p.prUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        PR <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : p.summary ? (
                      <span className="text-xs text-gray-400 truncate max-w-[200px] block" title={p.summary}>
                        {p.summary.slice(0, 60)}{p.summary.length > 60 ? "…" : ""}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SENSITIVE_PACKAGES = [
  { name: "next", label: "Next.js", icon: "▲" },
  { name: "@clerk/nextjs", label: "Clerk", icon: "🔐" },
  { name: "stripe", label: "Stripe Node", icon: "💳" },
  { name: "@stripe/stripe-js", label: "Stripe.js", icon: "💳" },
  { name: "prisma", label: "Prisma", icon: "🗄" },
];

const POLL_INTERVAL_MS = 30_000;

export default function MaintenancePage() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const r = await fetch("/api/admin/maintenance");
      const d = await r.json();
      setLogs(d.logs ?? []);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs(false);
    const id = setInterval(() => fetchLogs(true), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const lastRun = logs[0];
  const lastNightly = logs.find(l => l.actionType === "nightly_update");
  const lastWeekly = logs.find(l => l.actionType === "weekly_report");

  const allPackages: PackageResult[] = logs.flatMap(l => l.details?.packages ?? []);
  const latestByPkg = new Map<string, PackageResult>();
  for (const p of [...allPackages].reverse()) {
    latestByPkg.set(p.pkg, p);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Santé technique</h1>
          <p className="mt-1 text-sm text-gray-500">
            Surveillance autonome des dépendances — mises à jour automatiques + alertes Telegram
          </p>
          {lastRefreshed && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Mise à jour en direct · dernière sync {lastRefreshed.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchLogs(false)}
          disabled={refreshing}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Status cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dernier scan</p>
            {lastRun ? statusIcon(lastRun.status) : <Info className="h-4 w-4 text-gray-300" />}
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-800">
            {lastRun ? timeAgo(lastRun.createdAt) : "Jamais"}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {lastNightly ? `Nightly: ${timeAgo(lastNightly.createdAt)}` : "Aucun nightly"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rapport hebdo</p>
            {lastWeekly ? statusIcon(lastWeekly.status) : <Info className="h-4 w-4 text-gray-300" />}
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-800">
            {lastWeekly ? timeAgo(lastWeekly.createdAt) : "Aucun"}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Chaque lundi 07h00 UTC</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total runs</p>
            <RefreshCw className="h-4 w-4 text-gray-300" />
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-800">{logs.length}</p>
          <p className="mt-0.5 text-xs text-gray-400">30 derniers affichés</p>
        </div>
      </div>

      {/* Sensitive packages status */}
      {latestByPkg.size > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Paquets sensibles</h2>
          <div className="flex flex-wrap gap-2">
            {SENSITIVE_PACKAGES.map(({ name, label, icon }) => {
              const found = latestByPkg.get(name);
              if (!found) return (
                <div key={name} className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white px-3 py-1.5">
                  <span>{icon}</span>
                  <span className="text-xs font-medium text-gray-600">{label}</span>
                  <span className="text-xs text-gray-300">—</span>
                </div>
              );
              const ok = found.status === "up_to_date" || found.status === "updated" || found.status === "pr_exists";
              return (
                <div
                  key={name}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${ok ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"}`}
                >
                  <span>{icon}</span>
                  <span className={`text-xs font-medium ${ok ? "text-emerald-700" : "text-red-700"}`}>{label}</span>
                  <span className={`text-xs ${ok ? "text-emerald-500" : "text-red-500"}`}>
                    {found.latest ?? found.current ?? "?"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent info */}
      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-1">
            <p><strong>Automatisation :</strong> le Deps Agent tourne tous les soirs à 00h30 UTC via GitHub Actions.</p>
            <p><strong>Processus :</strong> npm outdated → branche dédiée → npm install → tsc → Claude (max 3 rounds) → PR avec auto-merge → Telegram.</p>
            <p><strong>Sécurité :</strong> chaque PR est bloquée par CI complet (lint + typecheck + unit tests + Next.js build + Playwright E2E).</p>
            <p><strong>Rapport hebdo :</strong> chaque lundi, analyse des changelogs Clerk/Stripe/Next.js/Prisma par Claude avec évaluation du risque.</p>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Historique des runs</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">Aucun run pour l&apos;instant</p>
            <p className="mt-1 text-xs text-gray-400">
              Le premier rapport apparaîtra après le prochain déclenchement GitHub Actions.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
