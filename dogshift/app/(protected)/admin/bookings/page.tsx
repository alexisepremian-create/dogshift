import Link from "next/link";
import { BookingStatus } from "@prisma/client";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CH", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value).replaceAll(".", "-");
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount / 100);
}

function statusLabel(status: BookingStatus) {
  if (status === BookingStatus.DRAFT) return "Brouillon";
  if (status === BookingStatus.PENDING_PAYMENT) return "En attente paiement";
  if (status === BookingStatus.PENDING_ACCEPTANCE) return "En attente validation";
  if (status === BookingStatus.PAID) return "Payée";
  if (status === BookingStatus.CONFIRMED) return "Confirmée";
  if (status === BookingStatus.PAYMENT_FAILED) return "Paiement échoué";
  if (status === BookingStatus.CANCELLED) return "Annulée";
  if (status === BookingStatus.REFUNDED) return "Remboursée";
  return "Remboursement échoué";
}

function statusTone(status: BookingStatus) {
  if (status === BookingStatus.PAID || status === BookingStatus.CONFIRMED) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === BookingStatus.DRAFT || status === BookingStatus.PENDING_PAYMENT || status === BookingStatus.PENDING_ACCEPTANCE) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (status === BookingStatus.CANCELLED || status === BookingStatus.REFUNDED || status === BookingStatus.REFUND_FAILED || status === BookingStatus.PAYMENT_FAILED) {
    return "border-rose-200 bg-rose-50 text-rose-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function statusGroupMatches(status: BookingStatus, statusGroup: string) {
  if (!statusGroup) return true;
  if (statusGroup === "pending") {
    return status === BookingStatus.DRAFT || status === BookingStatus.PENDING_PAYMENT || status === BookingStatus.PENDING_ACCEPTANCE;
  }
  if (statusGroup === "confirmed") {
    return status === BookingStatus.PAID || status === BookingStatus.CONFIRMED;
  }
  if (statusGroup === "cancelled") {
    return status === BookingStatus.CANCELLED || status === BookingStatus.REFUNDED || status === BookingStatus.REFUND_FAILED || status === BookingStatus.PAYMENT_FAILED;
  }
  return true;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("/admin/bookings");

  const resolvedSearchParams = await searchParams;
  const qRaw = resolvedSearchParams?.q;
  const statusRaw = resolvedSearchParams?.status;
  const cityRaw = resolvedSearchParams?.city;
  const startDateRaw = resolvedSearchParams?.startDate;
  const endDateRaw = resolvedSearchParams?.endDate;

  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw ?? "").trim();
  const statusGroup = (Array.isArray(statusRaw) ? statusRaw[0] : statusRaw ?? "").trim();
  const city = (Array.isArray(cityRaw) ? cityRaw[0] : cityRaw ?? "").trim();
  const startDate = (Array.isArray(startDateRaw) ? startDateRaw[0] : startDateRaw ?? "").trim();
  const endDate = (Array.isArray(endDateRaw) ? endDateRaw[0] : endDateRaw ?? "").trim();

  const createdAtFilter = {
    ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
    ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
  };

  const where = {
    ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
            { sitter: { name: { contains: q, mode: "insensitive" as const } } },
            { sitter: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(city
      ? {
          sitter: {
            sitterProfile: {
              city: { contains: city, mode: "insensitive" as const },
            },
          },
        }
      : {}),
  };

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      serviceType: true,
      service: true,
      amount: true,
      currency: true,
      createdAt: true,
      startDate: true,
      endDate: true,
      startAt: true,
      endAt: true,
      platformFeeAmount: true,
      sitterPayoutAmount: true,
      user: { select: { id: true, name: true, email: true } },
      sitter: { select: { id: true, name: true, email: true, sitterProfile: { select: { city: true } } } },
    },
  });

  const filteredBookings = bookings.filter((booking) => statusGroupMatches(booking.status, statusGroup));
  const totalBookings = filteredBookings.length;
  const pendingBookings = filteredBookings.filter(
    (booking) =>
      booking.status === BookingStatus.DRAFT ||
      booking.status === BookingStatus.PENDING_PAYMENT ||
      booking.status === BookingStatus.PENDING_ACCEPTANCE,
  );
  const confirmedBookings = filteredBookings.filter(
    (booking) => booking.status === BookingStatus.PAID || booking.status === BookingStatus.CONFIRMED,
  );
  const cancelledBookings = filteredBookings.filter(
    (booking) =>
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.REFUNDED ||
      booking.status === BookingStatus.REFUND_FAILED ||
      booking.status === BookingStatus.PAYMENT_FAILED,
  );
  const totalVolume = filteredBookings.reduce((sum, booking) => sum + booking.amount, 0);
  const confirmedVolume = confirmedBookings.reduce((sum, booking) => sum + booking.amount, 0);

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Réservations</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Gestion des réservations</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Vue V1 sur les réservations existantes, conçue pour rester compatible avec les futurs paiements, commissions et assurances sans refactor destructeur.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Réservations totales</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{totalBookings}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Confirmées</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{confirmedBookings.length}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">En attente</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{pendingBookings.length}</p>
          </div>
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Volume total</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{formatCurrency(totalVolume, "CHF")}</p>
          </div>
          <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Volume confirmé</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{formatCurrency(confirmedVolume, "CHF")}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <form className="grid gap-5 lg:grid-cols-2 xl:grid-cols-12 xl:items-end">
            <div className="flex min-w-0 flex-col gap-2 xl:col-span-3">
              <label htmlFor="q" className="text-sm font-medium text-slate-700">Recherche</label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Propriétaire ou dogsitter"
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 xl:col-span-2">
              <label htmlFor="status" className="text-sm font-medium text-slate-700">Statut</label>
              <select
                id="status"
                name="status"
                defaultValue={statusGroup}
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              >
                <option value="">Tous</option>
                <option value="pending">En attente</option>
                <option value="confirmed">Confirmées</option>
                <option value="cancelled">Annulées / incidents paiement</option>
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-2 xl:col-span-2">
              <label htmlFor="city" className="text-sm font-medium text-slate-700">Ville</label>
              <input
                id="city"
                name="city"
                defaultValue={city}
                placeholder="Ville du sitter"
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 xl:col-span-2">
              <label htmlFor="startDate" className="text-sm font-medium text-slate-700">Du</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={startDate}
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 xl:col-span-2">
              <label htmlFor="endDate" className="text-sm font-medium text-slate-700">Au</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={endDate}
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 xl:col-span-3">
              <span className="text-sm font-medium text-slate-700">Actions</span>
              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]"
                >
                  Filtrer
                </button>
                <Link
                  href="/admin/bookings"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Réinitialiser
                </Link>
              </div>
            </div>
          </form>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Lecture rapide</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Pipeline en attente</p>
                <p className="mt-2">{pendingBookings.length} réservations demandent encore une action paiement ou validation.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Revenu sécurisé</p>
                <p className="mt-2">{formatCurrency(confirmedVolume, "CHF")} déjà confirmé sur le périmètre filtré.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">Points de contrôle</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Annulations / incidents</p>
                <p className="mt-2">{cancelledBookings.length} réservations sont annulées, remboursées ou en échec de paiement.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Volume plateforme</p>
                <p className="mt-2">{formatCurrency(totalVolume, "CHF")} généré au total sur le périmètre filtré.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-semibold">Propriétaire</th>
                  <th className="px-5 py-4 font-semibold">Dogsitter</th>
                  <th className="px-5 py-4 font-semibold">Dates</th>
                  <th className="px-5 py-4 font-semibold">Statut</th>
                  <th className="px-5 py-4 font-semibold">Montant</th>
                  <th className="px-5 py-4 font-semibold">Création</th>
                  <th className="px-5 py-4 font-semibold">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="align-top">
                    <td className="px-5 py-4 text-slate-700">
                      <div>{booking.user.name?.trim() || "—"}</div>
                      <div className="text-xs text-slate-500">{booking.user.email}</div>
                      <Link href={`/admin/owners/${booking.user.id}`} className="mt-1 inline-block font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                        Voir
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      <div>{booking.sitter.name?.trim() || "—"}</div>
                      <div className="text-xs text-slate-500">{booking.sitter.email}</div>
                      <div className="text-xs text-slate-500">{booking.sitter.sitterProfile?.city || "—"}</div>
                      <Link href={`/admin/sitters/${booking.sitter.id}`} className="mt-1 inline-block font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                        Voir le sitter
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{formatDate(booking.startAt ?? booking.startDate)}</div>
                      <div className="text-xs text-slate-500">au {formatDate(booking.endAt ?? booking.endDate)}</div>
                      <div className="mt-1 text-xs text-slate-500">{booking.serviceType || booking.service || "—"}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(booking.status)}`}>
                        {statusLabel(booking.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{formatCurrency(booking.amount, booking.currency)}</div>
                      <div className="text-xs text-slate-500">Fee: {formatCurrency(booking.platformFeeAmount, booking.currency)}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(booking.createdAt)}</td>
                    <td className="px-5 py-4">
                      <Link href={`/admin/bookings/${booking.id}`} className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                        Voir la fiche
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredBookings.length === 0 ? <div className="border-t border-slate-200 px-5 py-6 text-sm text-slate-600">Aucune réservation trouvée pour ces filtres.</div> : null}
        </section>
      </div>
    </AdminShell>
  );
}
