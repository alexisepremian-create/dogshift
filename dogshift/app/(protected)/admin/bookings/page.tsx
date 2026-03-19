import Link from "next/link";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CH", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value).replaceAll(".", "-");
}

export default async function AdminBookingsPage() {
  await requireAdminPageAccess("/admin/bookings");

  const bookings = await prisma.booking.findMany({
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
      user: { select: { id: true, name: true, email: true } },
      sitter: { select: { id: true, name: true, email: true, sitterProfile: { select: { city: true } } } },
    },
  });

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

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-semibold">Statut</th>
                  <th className="px-5 py-4 font-semibold">Propriétaire</th>
                  <th className="px-5 py-4 font-semibold">Dogsitter</th>
                  <th className="px-5 py-4 font-semibold">Service</th>
                  <th className="px-5 py-4 font-semibold">Dates</th>
                  <th className="px-5 py-4 font-semibold">Montant</th>
                  <th className="px-5 py-4 font-semibold">Création</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="align-top">
                    <td className="px-5 py-4 font-medium text-slate-900">{booking.status}</td>
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
                    </td>
                    <td className="px-5 py-4 text-slate-600">{booking.serviceType || booking.service || "—"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{formatDate(booking.startAt ?? booking.startDate)}</div>
                      <div className="text-xs text-slate-500">au {formatDate(booking.endAt ?? booking.endDate)}</div>
                      <Link href={`/admin/bookings/${booking.id}`} className="mt-1 inline-block text-xs font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                        Voir la fiche
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{new Intl.NumberFormat("fr-CH", { style: "currency", currency: booking.currency.toUpperCase() }).format(booking.amount / 100)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(booking.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bookings.length === 0 ? <div className="border-t border-slate-200 px-5 py-6 text-sm text-slate-600">Aucune réservation trouvée.</div> : null}
        </section>
      </div>
    </AdminShell>
  );
}
