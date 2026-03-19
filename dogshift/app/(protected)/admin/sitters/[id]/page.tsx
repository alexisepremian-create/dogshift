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

export default async function AdminSitterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPageAccess();
  const { id } = await params;

  const sitter = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      sitterId: true,
      createdAt: true,
      updatedAt: true,
      sitterProfile: {
        select: {
          id: true,
          displayName: true,
          city: true,
          postalCode: true,
          bio: true,
          published: true,
          verificationStatus: true,
          verificationSubmittedAt: true,
          verificationReviewedAt: true,
          verificationNotes: true,
          services: true,
          pricing: true,
        },
      },
      sitterBookings: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          serviceType: true,
          amount: true,
          currency: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      },
      reviewsReceived: {
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      },
    },
  });

  if (!sitter) notFound();

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fiche dogsitter</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{sitter.name?.trim() || sitter.sitterProfile?.displayName || sitter.email}</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="font-semibold text-slate-900">Email :</span> {sitter.email}</p>
            <p><span className="font-semibold text-slate-900">Sitter ID :</span> {sitter.sitterId || "—"}</p>
            <p><span className="font-semibold text-slate-900">Ville :</span> {sitter.sitterProfile?.city || "—"}</p>
            <p><span className="font-semibold text-slate-900">Statut :</span> {sitter.sitterProfile?.verificationStatus || "—"}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Profil</h3>
              <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <p><span className="font-semibold text-slate-900">Publié :</span> {sitter.sitterProfile?.published ? "Oui" : "Non"}</p>
                <p><span className="font-semibold text-slate-900">Code postal :</span> {sitter.sitterProfile?.postalCode || "—"}</p>
                <p><span className="font-semibold text-slate-900">Soumis le :</span> {formatDate(sitter.sitterProfile?.verificationSubmittedAt || null)}</p>
                <p><span className="font-semibold text-slate-900">Relu le :</span> {formatDate(sitter.sitterProfile?.verificationReviewedAt || null)}</p>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">Bio</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{sitter.sitterProfile?.bio || "Aucune bio renseignée."}</p>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">Notes de vérification existantes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{sitter.sitterProfile?.verificationNotes || "Aucune note enregistrée."}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Historique des réservations</h3>
              {sitter.sitterBookings.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Aucune réservation liée pour le moment.</p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {sitter.sitterBookings.map((booking) => (
                    <div key={booking.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900">{booking.user.name?.trim() || booking.user.email}</p>
                        <p className="text-xs font-medium text-slate-500">{booking.status}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{booking.serviceType || "Service non défini"}</p>
                      <p className="mt-2 text-sm text-slate-600">Créée le {formatDate(booking.createdAt)}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {new Intl.NumberFormat("fr-CH", { style: "currency", currency: booking.currency.toUpperCase() }).format(booking.amount / 100)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">Avis récents</h3>
              {sitter.reviewsReceived.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Aucun avis reçu pour le moment.</p>
              ) : (
                <div className="mt-5 grid gap-3">
                  {sitter.reviewsReceived.map((review) => (
                    <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">Note: {review.rating}/5</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{review.comment || "Aucun commentaire."}</p>
                      <p className="mt-2 text-xs text-slate-500">{formatDate(review.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {sitter.sitterProfile ? <AdminNotesPanel targetType="SITTER_PROFILE" targetId={sitter.sitterProfile.id} /> : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
