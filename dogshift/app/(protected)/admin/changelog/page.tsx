"use client";

import { ExternalLink, GitMerge, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import AdminShell from "@/components/admin/AdminShell";

type PRType = "feat" | "fix" | "perf" | "refactor" | "security";
type PRArea = "owner" | "sitter" | "admin" | "core" | "infra";

type ChangelogEntry = {
  pr: number;
  date: string;
  type: PRType;
  title: string;
  summary: string;
  details: string[];
  area: PRArea[];
  url: string;
};

const TYPE_CONFIG: Record<PRType, { label: string; bg: string; text: string; border: string; dot: string }> = {
  feat:     { label: "Nouveauté",   bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  fix:      { label: "Correctif",   bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
  perf:     { label: "Performance", bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"    },
  refactor: { label: "Refacto",     bg: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200",   dot: "bg-slate-500"   },
  security: { label: "Sécurité",    bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-500"    },
};

const AREA_CONFIG: Record<PRArea, { label: string; bg: string; text: string }> = {
  owner:  { label: "Owner",  bg: "bg-violet-50",  text: "text-violet-700"  },
  sitter: { label: "Sitter", bg: "bg-sky-50",     text: "text-sky-700"     },
  admin:  { label: "Admin",  bg: "bg-orange-50",  text: "text-orange-700"  },
  core:   { label: "Core",   bg: "bg-slate-50",   text: "text-slate-700"   },
  infra:  { label: "Infra",  bg: "bg-zinc-50",    text: "text-zinc-700"    },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(entries: ChangelogEntry[]) {
  const map = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.date) ?? [];
    map.set(e.date, [...arr, e]);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function TypeBadge({ type }: { type: PRType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function AreaBadge({ area }: { area: PRArea }) {
  const cfg = AREA_CONFIG[area];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4 p-5">
        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 transition hover:border-slate-300 hover:bg-slate-100"
          title={`PR #${entry.pr}`}
        >
          #{entry.pr}
        </a>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={entry.type} />
            {entry.area.map((a) => <AreaBadge key={a} area={a} />)}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">{entry.title}</p>
          <p className="mt-0.5 text-sm text-slate-500">{entry.summary}</p>

          {entry.details.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--dogshift-blue)] transition hover:underline"
              >
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {expanded ? "Masquer les détails" : `Voir les détails (${entry.details.length})`}
              </button>
              {expanded && (
                <ul className="mt-2 space-y-1">
                  {entry.details.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <a
          href={entry.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 flex-shrink-0 inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <ExternalLink className="h-3 w-3" />
          Voir
        </a>
      </div>
    </div>
  );
}

function SkeletonEntry() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-9 w-9 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-slate-100" />
            <div className="h-5 w-12 rounded-full bg-slate-100" />
          </div>
          <div className="h-4 w-3/4 rounded-lg bg-slate-100" />
          <div className="h-3.5 w-1/2 rounded-lg bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/changelog");
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setError("Impossible de charger le changelog depuis GitHub.");
        return;
      }
      setEntries(payload.entries as ChangelogEntry[]);
      setLastRefreshed(new Date());
    } catch {
      setError("Erreur réseau lors du chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = groupByDate(entries);
  const total = entries.length;
  const featCount = entries.filter((e) => e.type === "feat").length;
  const fixCount = entries.filter((e) => e.type === "fix").length;

  return (
    <AdminShell>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <GitMerge className="h-4 w-4" />
              <span>Historique des mises à jour</span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Rafraîchir
            </button>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Changelog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Toutes les PRs mergées sur <code className="font-mono text-xs">main</code>, mises à jour automatiquement depuis GitHub.
          </p>

          {lastRefreshed && (
            <p className="mt-1 text-xs text-slate-400">
              Dernière synchro : {lastRefreshed.toLocaleTimeString("fr-FR")}
            </p>
          )}

          {/* Stats */}
          {!loading && (
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center shadow-sm">
                <p className="text-xl font-bold text-slate-900">{total}</p>
                <p className="text-xs text-slate-500">PRs mergés</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center shadow-sm">
                <p className="text-xl font-bold text-emerald-700">{featCount}</p>
                <p className="text-xs text-emerald-600">Nouveautés</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center shadow-sm">
                <p className="text-xl font-bold text-amber-700">{fixCount}</p>
                <p className="text-xs text-amber-600">Correctifs</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonEntry key={i} />)}
          </div>
        )}

        {/* Timeline */}
        {!loading && !error && (
          <div className="space-y-10">
            {groups.map(([date, dayEntries]) => (
              <div key={date}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[var(--dogshift-blue)]" />
                  <p className="text-sm font-semibold text-slate-700">{formatDate(date)}</p>
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs text-slate-400">{dayEntries.length} mise{dayEntries.length > 1 ? "s" : ""} à jour</span>
                </div>
                <div className="space-y-3 pl-5">
                  {dayEntries.map((entry) => (
                    <EntryCard key={entry.pr} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-12 text-center text-xs text-slate-400">
          Source : GitHub API · <code className="font-mono">alexisepremian-create/dogshift</code>
        </p>
      </div>
    </AdminShell>
  );
}
