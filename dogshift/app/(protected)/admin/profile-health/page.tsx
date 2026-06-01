/**
 * Admin → Santé des profils
 *
 * Shows the last 7 days of profile-health agent runs and, for the most recent
 * run, lists every remaining issue grouped by severity. Each row links into
 * `/admin/impersonate` so the admin can jump from "Sonia is broken" to
 * "browsing as Sonia" in one click.
 */
import Link from "next/link";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type IssueRow = {
  userId: string;
  targetEmail: string | null;
  check: string;
  severity: string;
  message: string;
};

type RunDetails = {
  sittersScanned?: number;
  ownersScanned?: number;
  fixedCounts?: Record<string, number>;
  unfixedIssues?: IssueRow[];
  probes?: Array<{ name: string; ok: boolean; status: number | null; error?: string }>;
  telegramSent?: boolean;
};

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("fr-CH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  }).format(d);
}

function severityColor(s: string) {
  if (s === "high") return "bg-rose-100 text-rose-700";
  if (s === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export default async function AdminProfileHealthPage() {
  await requireAdminPageAccess("/admin/profile-health");

  const runs = await prisma.agentLog.findMany({
    where: { agentName: "profile-health" },
    orderBy: { createdAt: "desc" },
    take: 7,
    select: {
      id: true,
      actionType: true,
      status: true,
      summary: true,
      durationMs: true,
      createdAt: true,
      details: true,
    },
  });

  const latest = runs[0];
  const details = (latest?.details ?? {}) as RunDetails;
  const issues = details.unfixedIssues ?? [];
  const failedProbes = (details.probes ?? []).filter((p) => !p.ok);

  return (
    <AdminShell>
      <div className="space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Santé des profils
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Agent autonome qui scanne chaque User + SitterProfile chaque nuit
            à 04h13 UTC. Vérifie les invariants (CGU, Stripe, lifecycle, dual-source
            services/dogSizes), corrige automatiquement ce qui est sûr,
            sonde les URLs publiques, et envoie un récap Telegram (maintenance).
          </p>
        </header>

        {/* ── Dernier run ─────────────────────────────────────────── */}
        {latest ? (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Dernier run — {formatTime(latest.createdAt)}
              </h2>
              <span
                className={
                  latest.status === "success"
                    ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                    : "rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700"
                }
              >
                {latest.status}
              </span>
            </div>
            <p className="text-sm text-slate-600">{latest.summary}</p>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase text-slate-500">Sitters</div>
                <div className="text-xl font-semibold">{details.sittersScanned ?? 0}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase text-slate-500">Owners</div>
                <div className="text-xl font-semibold">{details.ownersScanned ?? 0}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase text-slate-500">Auto-corrigés</div>
                <div className="text-xl font-semibold">
                  {Object.values(details.fixedCounts ?? {}).reduce((a, b) => a + b, 0)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase text-slate-500">Issues restantes</div>
                <div className="text-xl font-semibold">{issues.length}</div>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Aucun run pour l&apos;instant. Le cron tourne tous les jours à 04h13 UTC,
            ou tu peux le déclencher manuellement avec :
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              curl -H &quot;Authorization: Bearer $MAINTENANCE_API_KEY&quot; &apos;https://www.dogshift.ch/api/cron/profile-health-check?force=1&apos;
            </pre>
          </section>
        )}

        {/* ── Issues du dernier run ───────────────────────────────── */}
        {latest && issues.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Issues à traiter ({issues.length})
            </h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Sévérité</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Check</th>
                    <th className="px-4 py-3 text-left">Détail</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issues.map((iss, i) => (
                    <tr key={`${iss.userId}-${iss.check}-${i}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor(iss.severity)}`}>
                          {iss.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {iss.targetEmail ?? iss.userId}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-900">{iss.check}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{iss.message}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/impersonate?q=${encodeURIComponent(iss.targetEmail ?? "")}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          👁️ Voir comme
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* ── Failed probes ────────────────────────────────────────── */}
        {latest && failedProbes.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Probes HTTP en échec ({failedProbes.length})
            </h3>
            <div className="overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <ul className="space-y-1 text-sm">
                {failedProbes.map((p, i) => (
                  <li key={i} className="font-mono text-xs text-rose-800">
                    🔴 {p.name} — {p.error ?? `HTTP ${p.status}`}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* ── Historique ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            7 derniers runs
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Résumé</th>
                  <th className="px-4 py-3 text-right">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500">{formatTime(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.status === "success"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{r.summary ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
