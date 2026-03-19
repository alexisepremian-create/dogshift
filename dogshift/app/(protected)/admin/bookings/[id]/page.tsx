import { notFound } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import AdminNotesPanel from "@/components/admin/AdminNotesPanel";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(value)
    .replaceAll(".", "-");
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPageAccess();
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      serviceType: true,
      service: true,
      amount: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      startDate: true,
      endDate: true,
      startAt: true,
      endAt: true,
      message: true,
      user: { select: { id: true, name: true, email: true } },
      sitter: { select: { id: true, name: true, email: true, sitterId: true } },
    },
  });

  if (!booking) notFound();

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fiche réservation</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Réservation {booking.id}</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="font-semibold text-slate-900">Statut :</span> {booking.status}</p>
            <p><span className="font-semibold text-slate-900">Service :</span> {booking.serviceType || booking.service || "—"}</p>
            <p><span className="font-semibold text-slate-900">Début :</span> {formatDate(booking.startAt ?? booking.startDate)}</p>
            <p><span className="font-semibold text-slate-900">Fin :</span> {formatDate(booking.endAt ?? booking.endDate)}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Participants</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-700">Propriétaire</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{booking.user.name?.trim() || "—"}</p>
                  <p className="mt-1 text-sm text-slate-600">{booking.user.email}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-700">Dogsitter</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{booking.sitter.name?.trim() || "—"}</p>
                  <p className="mt-1 text-sm text-slate-600">{booking.sitter.email}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Détails</h3>
              <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <p><span className="font-semibold text-slate-900">Montant :</span> {new Intl.NumberFormat("fr-CH", { style: "currency", currency: booking.currency.toUpperCase() }).format(booking.amount / 100)}</p>
                <p><span className="font-semibold text-slate-900">Créée le :</span> {formatDate(booking.createdAt)}</p>
                <p><span className="font-semibold text-slate-900">Mise à jour :</span> {formatDate(booking.updatedAt)}</p>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">Message initial</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{booking.message || "Aucun message."}</p>
              </div>
            </section>
          </div>

          <AdminNotesPanel targetType="BOOKING" targetId={booking.id} />
        </section>
      </div>
    </AdminShell>
  );
}
