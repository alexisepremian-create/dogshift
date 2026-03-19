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

export default async function AdminOwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPageAccess();
  const { id } = await params;

  const owner = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      bookings: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          serviceType: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      },
      ownerConversations: {
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          updatedAt: true,
          lastMessagePreview: true,
        },
      },
    },
  });

  if (!owner) notFound();

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fiche propriétaire</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{owner.name?.trim() || owner.email}</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="font-semibold text-slate-900">Email :</span> {owner.email}</p>
            <p><span className="font-semibold text-slate-900">Rôle :</span> {owner.role}</p>
            <p><span className="font-semibold text-slate-900">Inscription :</span> {formatDate(owner.createdAt)}</p>
            <p><span className="font-semibold text-slate-900">Mise à jour :</span> {formatDate(owner.updatedAt)}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Historique des réservations</h3>
            {owner.bookings.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">Aucune réservation liée pour le moment.</p>
            ) : (
              <div className="mt-5 grid gap-3">
                {owner.bookings.map((booking) => (
                  <div key={booking.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">{booking.serviceType || "Service non défini"}</p>
                      <p className="text-xs font-medium text-slate-500">{booking.status}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">Créée le {formatDate(booking.createdAt)}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {new Intl.NumberFormat("fr-CH", { style: "currency", currency: booking.currency.toUpperCase() }).format(booking.amount / 100)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Historique récent</h3>
              {owner.ownerConversations.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Aucune conversation récente.</p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {owner.ownerConversations.map((conversation) => (
                    <div key={conversation.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-700">Conversation</p>
                      <p className="mt-2 text-sm text-slate-800">{conversation.lastMessagePreview || "Aperçu indisponible."}</p>
                      <p className="mt-2 text-xs text-slate-500">Mis à jour le {formatDate(conversation.updatedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <AdminNotesPanel targetType="USER" targetId={owner.id} />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
