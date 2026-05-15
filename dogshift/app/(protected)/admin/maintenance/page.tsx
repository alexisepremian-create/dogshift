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
  // The agent emits a "risk of breaking your app if you update" score, not
  // a "you should do this now" score. Reading "high" in red was making
  // Alexis think his prod was on fire when it wasn't. Map the raw level to
  // a plain-French label oriented around USER ACTION:
  //   low risk → safe to auto-update, the agent is handling it
  //   medium  → there's a PR worth a glance when you have time
  //   high    → breaking changes — INFO ONLY, do NOT rush this, the agent
  //             won't touch it and neither should you without a plan
  const map: Record<string, { className: string; label: string }> = {
    low: { className: "bg-emerald-100 text-emerald-700", label: "auto-update OK" },
    medium: { className: "bg-amber-100 text-amber-700", label: "à examiner" },
    high: { className: "bg-gray-100 text-gray-600 border border-gray-200", label: "info — pas urgent" },
  };
  const entry = map[risk] ?? { className: "bg-gray-100 text-gray-500", label: risk };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.className}`}>
      {entry.label}
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

// Sensitive packages, in **base priority order** (most business-critical first).
// The actual display order combines this base priority with the current state of
// each package (failing / has-updates / up-to-date) — see `sortedPackages` below.
//
// `guidance` is the short French explainer that opens when the pill is clicked.
// Keep these to ~2 sentences max so the panel stays scannable. The "que faire"
// line answers the only question that matters: what do I do *now*?
const SENSITIVE_PACKAGES: Array<{
  name: string;
  label: string;
  icon: string;
  priority: number;
  guidance: { what: string; action: string };
}> = [
  {
    name: "stripe",
    label: "Stripe Node",
    icon: "💳",
    priority: 1,
    guidance: {
      what: "SDK serveur Stripe — paiements, Stripe Connect, payouts sitters.",
      action:
        "Patches & minors : laisse l'auto-merge faire. Majeurs : lis le changelog d'abord (les noms d'API peuvent changer), surtout côté PaymentIntent et Connect.",
    },
  },
  {
    name: "prisma",
    label: "Prisma",
    icon: "🗄",
    priority: 2,
    guidance: {
      what: "ORM + CLI de migration DB. Couplé à @prisma/client.",
      action:
        "Toujours updater `prisma` ET `@prisma/client` ensemble (même version). Majeurs : suivre l'UPGRADE.md officiel + tester `prisma migrate deploy` sur une branche Neon avant prod.",
    },
  },
  {
    name: "@prisma/client",
    label: "@prisma/client",
    icon: "🗄",
    priority: 3,
    guidance: {
      what: "Runtime Prisma (TypeScript types + query engine).",
      action:
        "Bump en même temps que `prisma`. Si les types Prisma changent (`@prisma/client/runtime`), le `tsc` du CI catchera les incompatibilités.",
    },
  },
  {
    name: "next-auth",
    label: "Auth.js v5",
    icon: "🔐",
    priority: 4,
    guidance: {
      what: "Auth.js v5 (next-auth@beta) — sessions JWT, providers Google + Credentials.",
      action:
        "Sur la version beta, attention aux breaking en patch. Vérifier `auth.ts`, callbacks `jwt` et `session`, et tester le login Google + Credentials sur preview avant prod.",
    },
  },
  {
    name: "next",
    label: "Next.js",
    icon: "▲",
    priority: 5,
    guidance: {
      what: "Framework App Router (Turbopack). Coeur du serveur, SSR, routing.",
      action:
        "Patches : OK auto. Mineurs : lire les release notes (App Router évolue vite). Majors : tester le build + Playwright E2E avant de merger.",
    },
  },
  {
    name: "@stripe/stripe-js",
    label: "Stripe.js",
    icon: "💳",
    priority: 6,
    guidance: {
      what: "SDK navigateur Stripe (Elements, redirect to Checkout).",
      action:
        "Risque faible — frontend uniquement, les caches CDN absorbent les régressions visuelles. Auto-merge OK pour patches & minors.",
    },
  },
];

const POLL_INTERVAL_MS = 30_000;

export default function MaintenancePage() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Which sensitive package's detail card is currently expanded. Null = none.
  const [expandedPkg, setExpandedPkg] = useState<string | null>(null);

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

  // Sort sensitive packages so the row reads top-to-bottom as "needs your
  // attention → doesn't need anything". Action-oriented, not risk-oriented:
  //
  // Tier 0: actually broken (failed install / failed tsc) — fix now
  // Tier 1: a PR is open waiting for your review
  // Tier 2: medium-risk update available (worth a glance when you have time)
  // Tier 3: up to date OR low-risk (the agent has it / nothing to do)
  // Tier 4: high-risk major bump available — *info only*, don't rush
  // Tier 5: never scanned — no data yet
  //
  // Note: high-risk is deliberately ranked LAST among actionable tiers
  // because it's the kind of update the user should *not* be pressured to
  // do. Placing it before "à examiner" gave the wrong impression that it
  // was urgent.
  const sortedPackages = [...SENSITIVE_PACKAGES].sort((a, b) => {
    const tier = (name: string): number => {
      const found = latestByPkg.get(name);
      if (!found) return 5;
      if (found.status === "failed" || found.status === "ts_fix_failed") return 0;
      if (found.status === "pr_exists") return 1;
      if (found.status === "up_to_date" || found.status === "updated") return 3;
      // Has releases available — split by risk level.
      if (found.risk === "high") return 4;
      if (found.risk === "medium") return 2;
      if (found.risk === "low") return 3;
      // Unknown risk with updates → treat as "à examiner".
      return 2;
    };
    const ta = tier(a.name);
    const tb = tier(b.name);
    if (ta !== tb) return ta - tb;
    return a.priority - b.priority;
  });

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

      {/* Sensitive packages status — clickable pills with inline detail card */}
      {latestByPkg.size > 0 && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Paquets sensibles</h2>
          <p className="mb-3 text-xs text-gray-500">
            Triés par urgence pour toi — clique sur une pastille pour les détails.
            Tu n&apos;es <strong>jamais obligé</strong> de mettre à jour : tant que ton site marche, ignore les pastilles grises.
          </p>
          <div className="flex flex-wrap gap-2">
            {sortedPackages.map(({ name, label, icon }) => {
              const found = latestByPkg.get(name);
              const isExpanded = expandedPkg === name;

              // Pill colour: oriented around USER ACTION, not raw risk score.
              //
              //   red       → actually broken (failed npm install, failed tsc)
              //   amber     → has a PR open OR medium-risk update available;
              //               worth a glance when the user has time
              //   emerald   → up to date, OR low-risk auto-update will handle
              //   gray      → high-risk "info only" update exists (Prisma v7,
              //               Next major). The agent won't touch it and the
              //               user shouldn't rush it either — flagging this
              //               red was scaring the user into thinking prod
              //               was on fire when it wasn't.
              type Tone = "gray" | "emerald" | "amber" | "red";
              let tone: Tone;
              if (!found) {
                tone = "gray";
              } else if (found.status === "failed" || found.status === "ts_fix_failed") {
                tone = "red";
              } else if (found.status === "up_to_date" || found.status === "updated") {
                tone = "emerald";
              } else if (found.status === "pr_exists") {
                tone = "amber";
              } else if (found.risk === "high") {
                // Major bump available but breaking — info only, NOT urgent.
                tone = "gray";
              } else if (found.risk === "medium") {
                tone = "amber";
              } else if (found.risk === "low") {
                tone = "emerald";
              } else {
                // Has updates with unknown risk → neutral amber so it still
                // reads as "needs a glance" without screaming.
                tone = "amber";
              }

              const toneClass: Record<Tone, { pill: string; meta: string }> = {
                gray: {
                  pill: "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100",
                  meta: "text-gray-400",
                },
                emerald: {
                  pill: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                  meta: "text-emerald-500",
                },
                amber: {
                  pill: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                  meta: "text-amber-600",
                },
                red: {
                  pill: "border-red-300 bg-red-100 text-red-800 hover:bg-red-200",
                  meta: "text-red-600",
                },
              };
              const styles = toneClass[tone];

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setExpandedPkg(isExpanded ? null : name)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${styles.pill} ${isExpanded ? "ring-2 ring-blue-300" : ""}`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                  <span className={styles.meta}>
                    {found ? (found.latest ?? found.current ?? "?") : "—"}
                  </span>
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              );
            })}
          </div>

          {/* Inline detail card for the currently expanded pkg */}
          {expandedPkg && (() => {
            const cfg = sortedPackages.find(p => p.name === expandedPkg);
            if (!cfg) return null;
            const found = latestByPkg.get(expandedPkg);
            const versionLine = found
              ? found.current && found.latest && found.current !== found.latest
                ? `Installée : ${found.current} → dispo : ${found.latest}`
                : `Installée : ${found.current ?? found.latest ?? "?"}`
              : "Pas encore scanné par l'agent.";

            // Action recommandation — derived from current state, falls back
            // to the static `guidance.action` when nothing actionable.
            let stateBanner: { tone: "emerald" | "amber" | "red" | "gray"; text: string };
            if (!found) {
              stateBanner = { tone: "gray", text: "Aucune donnée — attends le prochain scan (nuit prochaine ou rapport hebdo de lundi)." };
            } else if (found.status === "up_to_date") {
              stateBanner = { tone: "emerald", text: "À jour. Rien à faire." };
            } else if (found.status === "updated") {
              stateBanner = { tone: "emerald", text: "Mis à jour automatiquement. Vérifie juste que le déploiement Vercel est passé." };
            } else if (found.status === "pr_exists") {
              stateBanner = { tone: "amber", text: "Une PR est ouverte avec la nouvelle version. À review + merger manuellement." };
            } else if (found.status === "ts_fix_failed") {
              stateBanner = { tone: "red", text: "L'update casse TypeScript et Claude n'a pas pu fixer. À faire à la main." };
            } else if (found.status === "failed") {
              stateBanner = { tone: "red", text: "L'update a échoué (npm install ou tsc). À investiguer." };
            } else if (found.risk === "high") {
              stateBanner = {
                tone: "gray",
                text: `${found.releases ?? "Plusieurs"} release(s) majeure(s) dispo(s), mais avec des breaking changes. **Ton site marche très bien sur la version actuelle — tu n'es PAS obligé de mettre à jour.** Garde ça en tête, on s'y mettra ensemble quand t'auras du temps tranquille.`,
              };
            } else if ((found.releases ?? 0) > 0) {
              stateBanner = { tone: "amber", text: `${found.releases} release(s) dispo(s) depuis ta version actuelle. À examiner.` };
            } else {
              stateBanner = { tone: "gray", text: "Statut inconnu." };
            }

            const banners = {
              emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
              amber: "border-amber-200 bg-amber-50 text-amber-800",
              red: "border-red-200 bg-red-50 text-red-800",
              gray: "border-gray-200 bg-gray-50 text-gray-700",
            };

            return (
              <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                      <code className="text-xs font-mono font-normal text-gray-500">{cfg.name}</code>
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">{versionLine}</p>
                  </div>
                  {found?.risk && riskBadge(found.risk)}
                </div>

                <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${banners[stateBanner.tone]}`}>
                  {/* Render simple **bold** markdown inline so the high-risk
                      banner can emphasise the "not obligatoire" reassurance. */}
                  {stateBanner.text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={i}>{part.slice(2, -2)}</strong>
                    ) : (
                      <span key={i}>{part}</span>
                    ),
                  )}
                </div>

                <div className="space-y-2 text-xs text-gray-700">
                  <div>
                    <p className="font-semibold text-gray-900">À quoi ça sert</p>
                    <p className="mt-0.5">{cfg.guidance.what}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Que faire</p>
                    <p className="mt-0.5">{cfg.guidance.action}</p>
                  </div>
                  {found?.summary && (
                    <div>
                      <p className="font-semibold text-gray-900">Note du dernier scan</p>
                      <p className="mt-0.5 italic text-gray-600">{found.summary}</p>
                    </div>
                  )}
                  {found?.prUrl && (
                    <a
                      href={found.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-1"
                    >
                      Voir la PR sur GitHub
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
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
            <p><strong>Rapport hebdo :</strong> chaque lundi, analyse des changelogs Auth.js/Stripe/Next.js/Prisma par Claude avec évaluation du risque.</p>
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
