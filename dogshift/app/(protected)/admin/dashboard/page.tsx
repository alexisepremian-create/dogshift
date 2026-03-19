import { BookingStatus, Role, VerificationStatus } from "@prisma/client";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type KpiCardProps = {
  label: string;
  value: number;
  tone?: "default" | "blue" | "emerald" | "amber" | "rose";
  helper?: string;
};

function KpiCard({ label, value, tone = "default", helper }: KpiCardProps) {
  const toneClass =
    tone === "blue"
      ? "border-sky-200 bg-sky-50"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50"
          : tone === "rose"
            ? "border-rose-200 bg-rose-50"
            : "border-slate-200 bg-white";

  return (
    <section className={`rounded-3xl border p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6 ${toneClass}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{helper}</p> : null}
    </section>
  );
}

export default async function AdminDashboardPage() {
  await requireAdminPageAccess("/admin/dashboard");

  const [
    totalUsers,
    totalOwners,
    totalSitters,
    sitterVerificationCounts,
    totalBookings,
    bookingStatusCounts,
    totalPilotApplications,
    pilotApplicationCounts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.OWNER } }),
    prisma.user.count({ where: { OR: [{ role: Role.SITTER }, { sitterId: { not: null } }] } }),
    prisma.sitterProfile.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.pilotSitterApplication.count(),
    prisma.pilotSitterApplication.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const verificationMap = new Map(sitterVerificationCounts.map((item) => [item.verificationStatus, item._count._all]));
  const bookingMap = new Map(bookingStatusCounts.map((item) => [item.status, item._count._all]));
  const pilotMap = new Map(pilotApplicationCounts.map((item) => [item.status, item._count._all]));

  const bookingPending =
    (bookingMap.get(BookingStatus.DRAFT) ?? 0) +
    (bookingMap.get(BookingStatus.PENDING_PAYMENT) ?? 0) +
    (bookingMap.get(BookingStatus.PENDING_ACCEPTANCE) ?? 0);
  const bookingConfirmed = (bookingMap.get(BookingStatus.PAID) ?? 0) + (bookingMap.get(BookingStatus.CONFIRMED) ?? 0);
  const bookingCancelled = (bookingMap.get(BookingStatus.CANCELLED) ?? 0) + (bookingMap.get(BookingStatus.REFUNDED) ?? 0);
  const bookingCompleted = 0;

  return (
    <AdminShell>
    <div className="grid gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vue globale</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Dashboard plateforme</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Cette V1 admin réutilise les modèles déjà en production et le panel existant des candidatures dogsitter, sans impact sur les routes publiques ni sur le SEO du site.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Utilisateurs" value={totalUsers} tone="blue" />
        <KpiCard label="Propriétaires" value={totalOwners} />
        <KpiCard label="Dogsitters" value={totalSitters} />
        <KpiCard label="Candidatures phase pilote" value={totalPilotApplications} helper="Flux existant conservé tel quel." />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Profils sitters en attente" value={verificationMap.get(VerificationStatus.pending) ?? 0} tone="amber" />
        <KpiCard label="Profils sitters validés" value={verificationMap.get(VerificationStatus.approved) ?? 0} tone="emerald" />
        <KpiCard label="Profils sitters refusés" value={verificationMap.get(VerificationStatus.rejected) ?? 0} tone="rose" />
        <KpiCard label="Profils non vérifiés" value={verificationMap.get(VerificationStatus.not_verified) ?? 0} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Réservations totales" value={totalBookings} tone="blue" />
        <KpiCard label="Réservations en attente" value={bookingPending} tone="amber" helper="Agrège draft, pending_payment et pending_acceptance." />
        <KpiCard label="Réservations confirmées" value={bookingConfirmed} tone="emerald" helper="Agrège paid et confirmed selon le modèle existant." />
        <KpiCard label="Réservations annulées" value={bookingCancelled} tone="rose" helper="Agrège cancelled et refunded." />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Candidatures phase pilote</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <KpiCard label="En attente" value={pilotMap.get("PENDING") ?? 0} tone="amber" />
            <KpiCard label="Contactées" value={pilotMap.get("CONTACTED") ?? 0} tone="blue" />
            <KpiCard label="Acceptées" value={pilotMap.get("ACCEPTED") ?? 0} tone="emerald" />
            <KpiCard label="Refusées" value={pilotMap.get("REJECTED") ?? 0} tone="rose" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Préparation des incidents</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Aucun modèle de signalement n’est ajouté à ce stade pour éviter une migration prématurée. La section admin est préparée pour accueillir cette couche plus tard sans refactor massif.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Signalements</p>
            <p className="mt-2 text-sm text-slate-600">0 incident suivi dans cette V1 admin.</p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">Étape suivante recommandée : modèle dédié avec notes internes, gravité, statut et entités liées.</p>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Terminées</p>
            <p className="mt-2 text-sm text-slate-600">{bookingCompleted} réservation terminée affichée.</p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">Le modèle actuel ne possède pas encore de statut `COMPLETED` explicite. Aucun changement de schéma n’est introduit dans cette étape conservative.</p>
          </div>
        </div>
      </section>
    </div>
    </AdminShell>
  );
}
