/**
 * Admin → Historique des emails envoyés
 *
 * Read-only timeline of every transactional email the platform sent
 * (via lib/email/sendEmail.ts). Useful to answer "Sonia se plaint d'avoir
 * reçu un email de suspension — c'est vrai ?" in 5 seconds instead of
 * 20 minutes of Resend dashboard / Vercel log grepping.
 *
 * Filterable by recipient, template, status, and date range.
 */
import Link from "next/link";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseQ(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("fr-CH", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  }).format(d);
}

// Human-readable French label for each known template id. Unknown templates
// keep their raw id in the UI (still searchable, but a soft signal that the
// caller should be tagged).
const TEMPLATE_LABELS: Record<string, string> = {
  // ── Auth ─────────────────────────────────────────────────────────────────
  "reset-password": "Mot de passe oublié",
  "email-verification": "Vérification d'email (signup)",
  "email-verification-resend": "Vérification d'email (re-envoi)",
  "signup-welcome": "Bienvenue (signup réussi)",

  // ── Inactivité (cron) ────────────────────────────────────────────────────
  "inactivity-nudge": "Inactivité — premier rappel",
  "inactivity-warning-1": "Inactivité — avertissement 1",
  "inactivity-warning-2": "Inactivité — avertissement 2 (suspension imminente)",
  "inactivity-suspended": "Inactivité — compte suspendu",

  // ── Réservations / avis ──────────────────────────────────────────────────
  "booking-review-request": "Demande d'avis post-réservation",

  // ── Lead magnet & nurturing ──────────────────────────────────────────────
  "lead-magnet-guide": "Guide dogsitter (lead magnet)",
  "lead-nurturing-step-1": "Lead nurturing — étape 1",
  "lead-nurturing-step-2": "Lead nurturing — étape 2",
  "lead-nurturing-step-3": "Lead nurturing — étape 3",

  // ── Relances + onboarding agents ────────────────────────────────────────
  "relance-owner-day-3": "Relance propriétaire — J+3",
  "onboarding-owner-step-1": "Onboarding propriétaire — étape 1",
  "zootherapie-evaluation": "Évaluation zoothérapie (Claude)",

  // ── Onboarding sitter ────────────────────────────────────────────────────
  "sitter-onboarding-nudge-welcome": "Onboarding sitter — bienvenue",
  "sitter-onboarding-nudge-day-1": "Onboarding sitter — J+1",
  "sitter-onboarding-nudge-day-3": "Onboarding sitter — J+3",
  "sitter-onboarding-nudge-day-7": "Onboarding sitter — J+7",
  "sitter-onboarding-nudge-day-14": "Onboarding sitter — J+14",

  // ── Candidatures sitter ──────────────────────────────────────────────────
  "sitter-application-received": "Candidature reçue (REVIEW/LOW)",
  "sitter-application-interview": "Candidature acceptée — interview Cal.com",
  "sitter-contract-issued": "Contrat émis par l'admin",
  "sitter-contract-signed": "Contrat signé — code d'activation",

  // ── Vérifications ────────────────────────────────────────────────────────
  "sitter-verification-submitted": "Vérification d'identité — soumise",
  "sitter-verification-approved": "Vérification d'identité — approuvée",
  "sitter-verification-rejected": "Vérification d'identité — refusée",
  "sitter-max-dogs-cert-submitted": "Certificat max chiens — soumis",
  "sitter-max-dogs-cert-reviewed": "Certificat max chiens — revu",
  "sitter-pension-verification-submitted": "Vérif pension — soumise",
  "sitter-pension-verification-reviewed": "Vérif pension — revue",

  // ── Notifications transactionnelles ──────────────────────────────────────
  "notification-new-message": "Notif — nouveau message",
  "notification-booking-request": "Notif — nouvelle demande de réservation",
  "notification-booking-confirmed": "Notif — réservation confirmée",
  "notification-payment-received": "Notif — paiement reçu",
  "notification-booking-reminder": "Notif — rappel de réservation",
  "notification-booking-cancelled": "Notif — réservation annulée",
  "notification-booking-refunded": "Notif — réservation remboursée",
  "notification-booking-auto-expired-refunded": "Notif — réservation expirée + remboursée",
  "notification-booking-refund-failed": "Notif — échec du remboursement",
  "notification-sitter-booking-confirmed": "Notif sitter — réservation confirmée",
  "notification-sitter-booking-reminder": "Notif sitter — rappel de réservation",
  "notification-sitter-payout-received": "Notif sitter — virement reçu",
  "notification-sitter-booking-modified": "Notif sitter — réservation modifiée",
  "notification-sitter-refund-triggered": "Notif sitter — remboursement déclenché",
  "notification-sitter-review-received": "Notif sitter — nouvel avis",
  "notification-sitter-monthly-recap": "Notif sitter — récap mensuel",

  // ── Communications admin ────────────────────────────────────────────────
  "admin-notify-users-broadcast": "Broadcast admin → utilisateurs",
  "admin-notify-pension-legacy": "Notif admin — pension legacy",
};

function labelTemplate(name: string | null): string {
  if (!name) return "(template inconnu)";
  return TEMPLATE_LABELS[name] ?? name;
}

const STATUS_BADGE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  skipped: "bg-slate-100 text-slate-600",
};

export default async function AdminEmailLogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("/admin/email-log");

  const sp = await searchParams;
  const q = parseQ(sp?.q);
  const template = parseQ(sp?.template);
  const status = parseQ(sp?.status);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const logs = await prisma.emailLog.findMany({
    where: {
      createdAt: { gte: since },
      ...(q
        ? {
            OR: [
              { to: { contains: q, mode: "insensitive" as const } },
              { subject: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(template ? { templateName: template } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      to: true,
      subject: true,
      templateName: true,
      context: true,
      status: true,
      mode: true,
      messageId: true,
      errorMessage: true,
      targetUserId: true,
      createdAt: true,
    },
  });

  const allTemplates = await prisma.emailLog.findMany({
    where: { createdAt: { gte: since } },
    distinct: ["templateName"],
    select: { templateName: true },
    take: 50,
  });

  const totals = await prisma.emailLog.groupBy({
    by: ["status"],
    where: { createdAt: { gte: since } },
    _count: true,
  });
  const counts = Object.fromEntries(totals.map((t) => [t.status, t._count])) as {
    sent?: number;
    failed?: number;
    skipped?: number;
  };

  return (
    <AdminShell>
      <div className="space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Historique des emails envoyés
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Tous les emails transactionnels (sitters + propriétaires) sont audit-loggés ici.
            Utile quand un sitter dit &laquo;&nbsp;j&apos;ai reçu un email bizarre&nbsp;&raquo; : tu
            peux vérifier en 5 secondes ce qui lui a réellement été envoyé. 30 derniers jours.
          </p>
        </header>

        {/* ── Compteurs ─────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs uppercase text-emerald-700">Envoyés (30j)</div>
            <div className="text-2xl font-semibold text-emerald-900">{counts.sent ?? 0}</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-xs uppercase text-rose-700">Échoués</div>
            <div className="text-2xl font-semibold text-rose-900">{counts.failed ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase text-slate-600">Ignorés (skipped)</div>
            <div className="text-2xl font-semibold text-slate-900">{counts.skipped ?? 0}</div>
          </div>
        </div>

        {/* ── Filtres ──────────────────────────────────────────── */}
        <form className="flex flex-wrap items-center gap-3" method="get" action="/admin/email-log">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Email destinataire ou sujet"
            className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-500"
          />
          <select
            name="template"
            defaultValue={template}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-500"
          >
            <option value="">Tous les templates</option>
            {allTemplates
              .map((t) => t.templateName)
              .filter((n): n is string => Boolean(n))
              .sort()
              .map((n) => (
                <option key={n} value={n}>
                  {labelTemplate(n)}
                </option>
              ))}
          </select>
          <select
            name="status"
            defaultValue={status}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-500"
          >
            <option value="">Tous les statuts</option>
            <option value="sent">Envoyés</option>
            <option value="failed">Échoués</option>
            <option value="skipped">Ignorés</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrer
          </button>
          {(q || template || status) ? (
            <Link href="/admin/email-log" className="text-sm text-slate-500 underline">
              Réinitialiser
            </Link>
          ) : null}
        </form>

        {/* ── Tableau ──────────────────────────────────────────── */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Destinataire</th>
                <th className="px-4 py-3 text-left">Type d&apos;email</th>
                <th className="px-4 py-3 text-left">Sujet</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    Aucun email ne correspond à ces filtres.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{log.to}</td>
                    <td className="px-4 py-3 text-xs text-slate-900">
                      <div>{labelTemplate(log.templateName)}</div>
                      {log.context ? (
                        <div className="text-[10px] text-slate-400">{log.context}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{log.subject}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[log.status] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {log.status}
                      </span>
                      {log.errorMessage ? (
                        <div className="mt-1 max-w-[300px] truncate text-[10px] text-rose-600" title={log.errorMessage}>
                          {log.errorMessage}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.targetUserId ? (
                        <Link
                          href={`/admin/impersonate?q=${encodeURIComponent(log.to)}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          👁️ Voir comme
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          300 emails max affichés (les plus récents sur 30 jours). Mode de l&apos;envoi
          (Resend / SMTP / log) et message id du provider sont enregistrés en base mais
          masqués ici pour simplifier.
        </p>
      </div>
    </AdminShell>
  );
}
