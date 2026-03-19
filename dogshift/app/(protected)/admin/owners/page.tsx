import Link from "next/link";
import { Role } from "@prisma/client";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-CH", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value).replaceAll(".", "-");
}

export default async function AdminOwnersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("/admin/owners");

  const resolvedSearchParams = await searchParams;
  const qRaw = resolvedSearchParams?.q;
  const bookingMinRaw = resolvedSearchParams?.bookingMin;

  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw ?? "").trim();
  const bookingMinValue = (Array.isArray(bookingMinRaw) ? bookingMinRaw[0] : bookingMinRaw ?? "").trim();
  const bookingMin = Number.isFinite(Number(bookingMinValue)) && bookingMinValue !== "" ? Number(bookingMinValue) : null;

  const where = {
    role: Role.OWNER,
    ...(q
      ? {
          OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }],
        }
      : {}),
    ...(bookingMin !== null
      ? {
          bookings: {
            some: {},
          },
        }
      : {}),
  };

  const owners = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      bookings: {
        select: {
          id: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      },
      ownerConversations: {
        select: {
          id: true,
        },
      },
      reviewsWritten: {
        select: {
          id: true,
        },
      },
    },
  });

  const filteredOwners = bookingMin === null ? owners : owners.filter((owner) => owner.bookings.length >= bookingMin);
  const ownersWithBookings = filteredOwners.filter((owner) => owner.bookings.length > 0).length;
  const activeConversationOwners = filteredOwners.filter((owner) => owner.ownerConversations.length > 0).length;
  const totalBookingVolume = filteredOwners.reduce(
    (sum, owner) => sum + owner.bookings.reduce((ownerSum: number, booking) => ownerSum + booking.amount, 0),
    0,
  );

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Propriétaires</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Utilisateurs propriétaires</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Première vue V1 des propriétaires inscrits, basée sur les données existantes et sans ajout de champ risqué en base.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Résultats</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{filteredOwners.length}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Liste filtrée sur les 100 comptes les plus récents.</p>
          </div>
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Avec réservation</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{ownersWithBookings}</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Avec conversation</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{activeConversationOwners}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Volume cumulé</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(totalBookingVolume / 100)}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_260px_auto]">
            <div className="grid gap-2">
              <label htmlFor="q" className="text-sm font-medium text-slate-700">Recherche</label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nom ou email"
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="bookingMin" className="text-sm font-medium text-slate-700">Minimum réservations</label>
              <input
                id="bookingMin"
                name="bookingMin"
                type="number"
                min="0"
                step="1"
                defaultValue={bookingMinValue}
                placeholder="0"
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Filtrer
              </button>
              <Link
                href="/admin/owners"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Réinitialiser
              </Link>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-semibold">Nom</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Inscription</th>
                  <th className="px-5 py-4 font-semibold">Réservations</th>
                  <th className="px-5 py-4 font-semibold">Conversations</th>
                  <th className="px-5 py-4 font-semibold">Avis</th>
                  <th className="px-5 py-4 font-semibold">Fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredOwners.map((owner) => (
                  <tr key={owner.id} className="align-top">
                    <td className="px-5 py-4 font-medium text-slate-900">{owner.name?.trim() || "—"}</td>
                    <td className="px-5 py-4 text-slate-700">{owner.email}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(owner.createdAt)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{owner.bookings.length}</div>
                      <div className="text-xs text-slate-500">
                        {new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(
                          owner.bookings.reduce((sum: number, booking) => sum + booking.amount, 0) / 100,
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{owner.ownerConversations.length}</td>
                    <td className="px-5 py-4 text-slate-600">{owner.reviewsWritten.length}</td>
                    <td className="px-5 py-4">
                      <Link href={`/admin/owners/${owner.id}`} className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                        Voir la fiche
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredOwners.length === 0 ? <div className="border-t border-slate-200 px-5 py-6 text-sm text-slate-600">Aucun propriétaire trouvé pour ces filtres.</div> : null}
        </section>
      </div>
    </AdminShell>
  );
}
