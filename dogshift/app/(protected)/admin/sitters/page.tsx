import Link from "next/link";
import { VerificationStatus } from "@prisma/client";

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

export default async function AdminSittersPage() {
  await requireAdminPageAccess("/admin/sitters");

  const sitters = await prisma.user.findMany({
    where: { sitterId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      sitterId: true,
      createdAt: true,
      sitterProfile: {
        select: {
          city: true,
          verificationStatus: true,
          verificationNotes: true,
          published: true,
        },
      },
    },
  });

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
                  <th className="px-5 py-4 font-semibold">Inscription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sitters.map((sitter) => (
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
                    <td className="px-5 py-4 text-slate-600">{sitter.sitterProfile ? verificationLabel(sitter.sitterProfile.verificationStatus) : "—"}</td>
                    <td className="px-5 py-4 text-slate-600">{sitter.sitterProfile?.published ? "Oui" : "Non"}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(sitter.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sitters.length === 0 ? <div className="border-t border-slate-200 px-5 py-6 text-sm text-slate-600">Aucun sitter trouvé.</div> : null}
        </section>
      </div>
    </AdminShell>
  );
}
