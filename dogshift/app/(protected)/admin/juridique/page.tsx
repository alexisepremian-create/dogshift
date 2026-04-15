import type { Metadata } from "next";
import Link from "next/link";
import { Download, Info } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getAdminSessionFromCookies, isValidAdminSessionValue } from "@/lib/adminAuth";

export const metadata: Metadata = { title: "Journal juridique — Admin" };

// ─── Config ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 80;

const ACTION_LABELS: Record<string, string> = {
  "booking.created":       "Réservation créée",
  "booking.paid":          "Paiement reçu",
  "booking.confirmed":     "Réservation confirmée",
  "booking.cancelled":     "Réservation annulée",
  "booking.refunded":      "Remboursement effectué",
  "sitter.select":         "Sitter sélectionné",
  "sitter.approve":        "Sitter approuvé",
  "sitter.reject":         "Sitter refusé",
  "sitter.suspend":        "Sitter suspendu",
  "sitter.reactivate":     "Sitter réactivé",
  "sitter.publish":        "Profil publié",
  "sitter.unpublish":      "Profil dépublié",
  "sitter.generate_contract_link": "Lien contrat généré",
  "application.status_change":     "Candidature — statut changé",
  "account.delete":        "Compte supprimé",
  "platform.settings_change":      "Paramètres plateforme modifiés",
};

const ACTION_COLORS: Record<string, string> = {
  "booking.created":     "bg-blue-50 text-blue-700 border-blue-200",
  "booking.paid":        "bg-emerald-50 text-emerald-700 border-emerald-200",
  "booking.confirmed":   "bg-emerald-50 text-emerald-700 border-emerald-200",
  "booking.cancelled":   "bg-amber-50 text-amber-700 border-amber-200",
  "booking.refunded":    "bg-amber-50 text-amber-700 border-amber-200",
  "sitter.approve":      "bg-emerald-50 text-emerald-700 border-emerald-200",
  "sitter.reject":       "bg-rose-50 text-rose-700 border-rose-200",
  "sitter.suspend":      "bg-rose-50 text-rose-700 border-rose-200",
  "sitter.reactivate":   "bg-emerald-50 text-emerald-700 border-emerald-200",
  "account.delete":      "bg-rose-50 text-rose-700 border-rose-200",
};

function actionColor(action: string) {
  return ACTION_COLORS[action] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

function actorBadgeColor(type: string) {
  if (type === "admin")  return "bg-violet-50 text-violet-700";
  if (type === "stripe") return "bg-blue-50 text-blue-700";
  if (type === "user")   return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-500";
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("fr-CH", {
    timeZone: "Europe/Zurich",
    year:  "numeric",
    month: "2-digit",
    day:   "2-digit",
    hour:  "2-digit",
    minute:"2-digit",
    second:"2-digit",
  }).format(d);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminJuridiquePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  // Auth guard
  const sessionValue = await getAdminSessionFromCookies();
  const isAdmin = isValidAdminSessionValue(sessionValue);
  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Accès refusé.
      </div>
    );
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const actionFilter = typeof sp.action === "string" ? sp.action : "";
  const skip = (page - 1) * PAGE_SIZE;
  const where = actionFilter ? { action: actionFilter } : {};

  const [total, rows] = await Promise.all([
    (prisma as any).auditLog.count({ where }),
    (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build filter URL helpers
  function filterUrl(action: string) {
    const p = new URLSearchParams();
    if (action) p.set("action", action);
    p.set("page", "1");
    return `/admin/juridique?${p.toString()}`;
  }
  function pageUrl(p: number) {
    const ps = new URLSearchParams();
    if (actionFilter) ps.set("action", actionFilter);
    ps.set("page", String(p));
    return `/admin/juridique?${ps.toString()}`;
  }
  function csvUrl() {
    const ps = new URLSearchParams();
    if (actionFilter) ps.set("action", actionFilter);
    ps.set("format", "csv");
    return `/api/admin/audit?${ps.toString()}`;
  }

  const allActions = Object.keys(ACTION_LABELS);

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-2">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Journal juridique</h2>
          <p className="mt-2 text-sm text-slate-500">
            Trace immuable de toutes les actions critiques — à conserver en cas de litige.
          </p>
        </div>
        <a
          href={csvUrl()}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Exporter CSV
        </a>
      </div>

      {/* Notice légale */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <Info className="mt-0.5 h-4 w-4 flex-none text-blue-500" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-blue-700">
          Ce journal est <strong>append-only</strong> — aucune entrée ne peut être modifiée ou supprimée.
          En cas de litige, exportez en CSV et transmettez-le à votre conseil juridique ou à l&apos;autorité compétente.
          Aucune donnée personnelle (email, nom) n&apos;est stockée ici — uniquement des identifiants techniques.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5">
        <Link
          href={filterUrl("")}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
            !actionFilter
              ? "border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_88%)] text-[var(--dogshift-blue)]"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Tout ({total})
        </Link>
        {allActions.map((a) => (
          <Link
            key={a}
            href={filterUrl(a)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              actionFilter === a
                ? "border-[var(--dogshift-blue)] bg-[color-mix(in_srgb,var(--dogshift-blue),white_88%)] text-[var(--dogshift-blue)]"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {ACTION_LABELS[a]}
          </Link>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Aucun événement enregistré pour ce filtre.
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_4px_24px_-8px_rgba(2,6,23,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500">Date (Zurich)</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500">Action</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500">Acteur</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500">Acteur ID</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500">Cible</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500">Cible ID</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-500">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any) => (
                  <tr key={row.id} className="group transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {formatDate(new Date(row.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${actionColor(row.action)}`}>
                        {ACTION_LABELS[row.action] ?? row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actorBadgeColor(row.actorType)}`}>
                        {row.actorType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {row.actorId ? (
                        <span className="max-w-[140px] truncate block" title={row.actorId}>{row.actorId}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.targetType ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {row.targetId ? (
                        <span className="max-w-[140px] truncate block" title={row.targetId}>{row.targetId}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.metadata ? (
                        <details className="cursor-pointer">
                          <summary className="text-xs text-slate-400 hover:text-slate-700">voir</summary>
                          <pre className="mt-1 max-w-xs overflow-x-auto rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              {total} événement{total > 1 ? "s" : ""} — page {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={pageUrl(page - 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link href={pageUrl(page + 1)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
