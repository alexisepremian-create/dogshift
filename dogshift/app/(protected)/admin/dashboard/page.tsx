import Link from "next/link";
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

type ActionLinkProps = {
  href: string;
  title: string;
  description: string;
};

function formatCurrencyCents(amount: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

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

function ActionLink({ href, title, description }: ActionLinkProps) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--dogshift-blue)] hover:bg-[color-mix(in_srgb,var(--dogshift-blue),white_96%)]"
    >
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  await requireAdminPageAccess("/admin/dashboard");

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    totalOwners,
    totalSitters,
    sitterVerificationCounts,
    totalBookings,
    bookingStatusCounts,
    totalPilotApplications,
    pilotApplicationCounts,
    recentUsers,
    recentBookings,
    recentPilotApplications,
    pendingVerificationProfiles,
    publishedSitterProfiles,
    totalConversations,
    recentConversations,
    totalReviews,
    recentReviews,
    totalAdminNotes,
    recentAdminNotes,
    bookedAmountAggregate,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.OWNER } }),
    prisma.user.count({ where: { OR: [{ role: Role.SITTER }, { sitterId: { not: null } }] } }),
    prisma.sitterProfile.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.pilotSitterApplication.count(),
    prisma.pilotSitterApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.booking.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.pilotSitterApplication.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.sitterProfile.count({ where: { verificationStatus: VerificationStatus.pending } }),
    prisma.sitterProfile.count({ where: { published: true } }),
    prisma.conversation.count(),
    prisma.conversation.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.review.count(),
    prisma.review.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.adminNote.count(),
    prisma.adminNote.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.booking.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        status: {
          in: [BookingStatus.PAID, BookingStatus.CONFIRMED],
        },
      },
    }),
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
  const confirmedBookingVolume = bookedAmountAggregate._sum.amount ?? 0;

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vue globale</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Dashboard plateforme</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Ce dashboard admin consolide l’activité utile à l’exploitation quotidienne en réutilisant strictement les modèles déjà en production, sans impact sur les routes publiques ni sur le SEO.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[460px]">
              <ActionLink href="/admin/sitters/applications" title="Traiter les candidatures" description="Accéder directement au panel existant des candidatures dogsitter phase pilote." />
              <ActionLink href="/admin/sitters" title="Suivre les sitters" description="Voir les profils sitters, leur publication et leur état de vérification." />
              <ActionLink href="/admin/owners" title="Contrôler les propriétaires" description="Accéder aux fiches propriétaires et à leur historique de réservations." />
              <ActionLink href="/admin/bookings" title="Surveiller les réservations" description="Contrôler les statuts, dates et montants des réservations existantes." />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Utilisateurs" value={totalUsers} tone="blue" helper={`${recentUsers} nouveaux sur 30 jours.`} />
          <KpiCard label="Propriétaires" value={totalOwners} helper="Basé sur le rôle OWNER existant." />
          <KpiCard label="Dogsitters" value={totalSitters} helper={`${publishedSitterProfiles} profils publiés actuellement.`} />
          <KpiCard label="Candidatures phase pilote" value={totalPilotApplications} tone="amber" helper={`${recentPilotApplications} reçues sur 30 jours.`} />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Réservations totales" value={totalBookings} tone="blue" helper={`${recentBookings} créées sur 30 jours.`} />
          <KpiCard label="Réservations en attente" value={bookingPending} tone="amber" helper="Agrège draft, pending_payment et pending_acceptance." />
          <KpiCard label="Réservations confirmées" value={bookingConfirmed} tone="emerald" helper={confirmedBookingVolume > 0 ? `${formatCurrencyCents(confirmedBookingVolume)} confirmés.` : "Agrège paid et confirmed selon le modèle existant."} />
          <KpiCard label="Réservations annulées" value={bookingCancelled} tone="rose" helper="Agrège cancelled et refunded." />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Profils sitters en attente" value={pendingVerificationProfiles} tone="amber" helper="Profils à relire côté vérification d’identité." />
          <KpiCard label="Profils sitters validés" value={verificationMap.get(VerificationStatus.approved) ?? 0} tone="emerald" />
          <KpiCard label="Conversations" value={totalConversations} helper={`${recentConversations} actives sur 7 jours.`} />
          <KpiCard label="Notes internes admin" value={totalAdminNotes} helper={`${recentAdminNotes} ajoutées sur 7 jours.`} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Candidatures phase pilote</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <KpiCard label="En attente" value={pilotMap.get("PENDING") ?? 0} tone="amber" />
              <KpiCard label="Contactées" value={pilotMap.get("CONTACTED") ?? 0} tone="blue" />
              <KpiCard label="Acceptées" value={pilotMap.get("ACCEPTED") ?? 0} tone="emerald" />
              <KpiCard label="Refusées" value={pilotMap.get("REJECTED") ?? 0} tone="rose" />
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Lecture rapide</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <p>{pilotMap.get("PENDING") ?? 0} candidatures attendent encore une prise en charge.</p>
                <p>{pilotMap.get("ACCEPTED") ?? 0} candidatures ont déjà été validées dans le flux pilote existant.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Activité récente</h2>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">30 derniers jours</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p>{recentUsers} nouveaux utilisateurs.</p>
                    <p>{recentBookings} nouvelles réservations.</p>
                    <p>{recentPilotApplications} nouvelles candidatures pilote.</p>
                    <p>{recentReviews} nouveaux avis.</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">7 derniers jours</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p>{recentConversations} conversations mises à jour.</p>
                    <p>{recentAdminNotes} notes internes ajoutées.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Préparation des incidents</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                Aucun modèle de signalement n’est ajouté à ce stade pour éviter une migration prématurée. La structure admin actuelle est cependant prête à accueillir cette couche plus tard sans refactor massif.
              </p>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Signalements</p>
                <p className="mt-2 text-sm text-slate-600">0 incident suivi dans cette version conservative du panel admin.</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">Étape suivante recommandée : modèle dédié avec gravité, statut, notes internes et historique d’actions.</p>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Terminées</p>
                <p className="mt-2 text-sm text-slate-600">{bookingCompleted} réservation terminée affichée.</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">Le modèle actuel ne possède pas encore de statut `COMPLETED` explicite. Aucun changement de schéma n’est introduit dans cette étape conservative.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Parcours dogsitters</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <p>{verificationMap.get(VerificationStatus.not_verified) ?? 0} profils non vérifiés.</p>
              <p>{verificationMap.get(VerificationStatus.pending) ?? 0} profils en attente de revue.</p>
              <p>{verificationMap.get(VerificationStatus.approved) ?? 0} profils validés.</p>
              <p>{publishedSitterProfiles} profils sont actuellement publiés.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Parcours propriétaires</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <p>{totalOwners} propriétaires enregistrés.</p>
              <p>{recentUsers} nouveaux comptes utilisateurs sur 30 jours.</p>
              <p>{totalConversations} conversations créées au total.</p>
              <p>{totalReviews} avis publiés sur la plateforme.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Parcours réservations</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <p>{bookingPending} réservations en attente.</p>
              <p>{bookingConfirmed} réservations confirmées ou payées.</p>
              <p>{bookingCancelled} réservations annulées ou remboursées.</p>
              <p>{confirmedBookingVolume > 0 ? formatCurrencyCents(confirmedBookingVolume) : "CHF 0"} de volume confirmé.</p>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
