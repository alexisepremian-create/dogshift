import { notFound } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";
import AdminNotesPanel from "@/components/admin/AdminNotesPanel";
import AdminBookingPayoutControls from "@/components/admin/AdminBookingPayoutControls";
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

function eventTone(eventType: string) {
  if (eventType.includes("FAILED")) return "border-rose-200 bg-rose-50 text-rose-900";
  if (eventType.includes("PAID") || eventType.includes("CREATED") || eventType.includes("RECEIVED")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (eventType.includes("MANUAL")) return "border-sky-200 bg-sky-50 text-sky-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
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

  const financeEvents = await (prisma as any).bookingFinanceEvent.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      eventType: true,
      message: true,
      payoutMethod: true,
      payoutStatus: true,
      stripeChargeId: true,
      stripeTransferId: true,
      stripePaymentIntentId: true,
      createdAt: true,
    },
  });

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

            <AdminBookingPayoutControls bookingId={booking.id} />

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Historique financier</h3>
              <div className="mt-4 grid gap-3">
                {financeEvents.map((event: any) => (
                  <article key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${eventTone(String(event.eventType))}`}>
                        {event.eventType}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(event.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800">{event.message}</p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      <p>Methode: <span className="font-semibold text-slate-800">{event.payoutMethod || "—"}</span></p>
                      <p>Statut: <span className="font-semibold text-slate-800">{event.payoutStatus || "—"}</span></p>
                      <p className="font-mono">PI: {event.stripePaymentIntentId || "—"}</p>
                      <p className="font-mono">Charge: {event.stripeChargeId || "—"}</p>
                      <p className="font-mono sm:col-span-2">Transfer: {event.stripeTransferId || "—"}</p>
                    </div>
                  </article>
                ))}
                {financeEvents.length === 0 ? <p className="text-sm text-slate-600">Aucun événement financier pour le moment.</p> : null}
              </div>
            </section>
          </div>

          <AdminNotesPanel targetType="BOOKING" targetId={booking.id} />
        </section>
      </div>
    </AdminShell>
  );
}
