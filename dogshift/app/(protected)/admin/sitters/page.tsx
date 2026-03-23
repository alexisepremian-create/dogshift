import Link from "next/link";
import { VerificationStatus } from "@prisma/client";

import AdminSitterActions from "@/components/admin/AdminSitterActions";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-CH", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value).replaceAll(".", "-");
}

function verificationLabel(status: VerificationStatus) {
  if (status === VerificationStatus.approved) return "Approuvé";
  if (status === VerificationStatus.pending) return "En attente";
  if (status === VerificationStatus.rejected) return "Refusé";
  return "Non vérifié";
}

function verificationTone(status: VerificationStatus) {
  if (status === VerificationStatus.approved) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === VerificationStatus.pending) return "border-amber-200 bg-amber-50 text-amber-900";
  if (status === VerificationStatus.rejected) return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function publishedLabel(value: boolean | undefined) {
  return value ? "Publié" : "Non publié";
}

export default async function AdminSittersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("/admin/sitters");

  const resolvedSearchParams = await searchParams;
  const qRaw = resolvedSearchParams?.q;
  const cityRaw = resolvedSearchParams?.city;
  const verificationRaw = resolvedSearchParams?.verification;
  const publishedRaw = resolvedSearchParams?.published;

  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw ?? "").trim();
  const city = (Array.isArray(cityRaw) ? cityRaw[0] : cityRaw ?? "").trim();
  const verification = (Array.isArray(verificationRaw) ? verificationRaw[0] : verificationRaw ?? "").trim() as VerificationStatus | "";
  const published = (Array.isArray(publishedRaw) ? publishedRaw[0] : publishedRaw ?? "").trim();

  const where = {
    sitterId: { not: null as string | null },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { sitterId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(city || verification || published
      ? {
          sitterProfile: {
            ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}),
            ...(verification ? { verificationStatus: verification } : {}),
            ...(published === "published" ? { published: true } : {}),
            ...(published === "unpublished" ? { published: false } : {}),
          },
        }
      : {}),
  };

  const [sitters, totalSitters, publishedCount, pendingCount, approvedCount] = await Promise.all([
    (prisma as any).user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        sitterId: true,
        createdAt: true,
        sitterBookings: { select: { id: true } },
        reviewsReceived: { select: { id: true } },
        sitterProfile: {
          select: {
            city: true,
            verificationStatus: true,
            verificationNotes: true,
            published: true,
            profileCompletion: true,
            lifecycleStatus: true,
            activationCodeIssuedAt: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, sitterProfile: { ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}), ...(verification ? { verificationStatus: verification } : {}), published: true } } }),
    prisma.user.count({ where: { ...where, sitterProfile: { ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}), verificationStatus: VerificationStatus.pending, ...(published === "published" ? { published: true } : {}), ...(published === "unpublished" ? { published: false } : {}) } } }),
    prisma.user.count({ where: { ...where, sitterProfile: { ...(city ? { city: { contains: city, mode: "insensitive" as const } } : {}), verificationStatus: VerificationStatus.approved, ...(published === "published" ? { published: true } : {}), ...(published === "unpublished" ? { published: false } : {}) } } }),
  ]);

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dogsitters</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Profils sitters</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Vue V1 sur les sitters existants en base, distincte des candidatures phase pilote déjà conservées dans `/admin/sitters/applications`.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/admin/sitters/applications" className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
              Voir les candidatures
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Résultats</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{totalSitters}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">Liste filtrée sur les 100 profils les plus récents.</p>
          </div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Profils publiés</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{publishedCount}</p>
          </div>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Vérifications en attente</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{pendingCount}</p>
          </div>
          <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-6">
            <p className="text-sm font-medium text-slate-600">Profils approuvés</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{approvedCount}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="grid gap-2">
              <label htmlFor="q" className="text-sm font-medium text-slate-700">Recherche</label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Nom, email ou sitter ID"
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="city" className="text-sm font-medium text-slate-700">Ville</label>
              <input
                id="city"
                name="city"
                defaultValue={city}
                placeholder="Lausanne, Genève…"
                className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2 lg:col-span-1">
              <div className="grid gap-2">
                <label htmlFor="verification" className="text-sm font-medium text-slate-700">Vérification</label>
                <select
                  id="verification"
                  name="verification"
                  defaultValue={verification}
                  className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
                >
                  <option value="">Tous</option>
                  <option value={VerificationStatus.not_verified}>Non vérifié</option>
                  <option value={VerificationStatus.pending}>En attente</option>
                  <option value={VerificationStatus.approved}>Approuvé</option>
                  <option value={VerificationStatus.rejected}>Refusé</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="published" className="text-sm font-medium text-slate-700">Publication</label>
                <select
                  id="published"
                  name="published"
                  defaultValue={published}
                  className="h-11 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
                >
                  <option value="">Tous</option>
                  <option value="published">Publiés</option>
                  <option value="unpublished">Non publiés</option>
                </select>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Filtrer
              </button>
              <Link
                href="/admin/sitters"
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
                  <th className="px-5 py-4 font-semibold">Profil</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Localisation</th>
                  <th className="px-5 py-4 font-semibold">Statut</th>
                  <th className="px-5 py-4 font-semibold">Publié</th>
                  <th className="px-5 py-4 font-semibold">Complétion</th>
                  <th className="px-5 py-4 font-semibold">Activité</th>
                  <th className="px-5 py-4 font-semibold">Inscription</th>
                  <th className="w-[252px] px-5 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sitters.map((sitter: any) => (
                  <tr key={sitter.id} className="align-top">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{sitter.name?.trim() || sitter.sitterId || "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">{sitter.sitterId || "—"}</div>
                      <Link href={`/admin/sitters/${sitter.id}`} className="mt-1 inline-block text-xs font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
                        Voir la fiche
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{sitter.email}</td>
                    <td className="px-5 py-4 text-slate-600">{sitter.sitterProfile?.city || "—"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {sitter.sitterProfile ? (
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${verificationTone(sitter.sitterProfile.verificationStatus)}`}>
                          {verificationLabel(sitter.sitterProfile.verificationStatus)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{publishedLabel(sitter.sitterProfile?.published)}</td>
                    <td className="px-5 py-4 text-slate-600">{typeof sitter.sitterProfile?.profileCompletion === "number" ? `${sitter.sitterProfile.profileCompletion}%` : "—"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      <div>{sitter.sitterBookings.length} réservations</div>
                      <div className="text-xs text-slate-500">{sitter.reviewsReceived.length} avis</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(sitter.createdAt)}</td>
                    <td className="w-[252px] px-5 py-4 align-top">
                      {sitter.sitterProfile ? (
                        <AdminSitterActions
                          sitterUserId={sitter.id}
                          initialPublished={sitter.sitterProfile.published}
                          initialVerificationStatus={sitter.sitterProfile.verificationStatus}
                          initialVerificationNotes={sitter.sitterProfile.verificationNotes}
                          initialLifecycleStatus={sitter.sitterProfile.lifecycleStatus ?? "application_received"}
                          initialActivationCodeIssuedAt={
                            sitter.sitterProfile.activationCodeIssuedAt instanceof Date
                              ? sitter.sitterProfile.activationCodeIssuedAt.toISOString()
                              : null
                          }
                          compact
                        />
                      ) : (
                        <span className="text-sm text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sitters.length === 0 ? <div className="border-t border-slate-200 px-5 py-6 text-sm text-slate-600">Aucun sitter trouvé pour ces filtres.</div> : null}
        </section>
      </div>
    </AdminShell>
  );
}
