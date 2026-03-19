import Link from "next/link";
import { Role } from "@prisma/client";

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-CH", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value).replaceAll(".", "-");
}

export default async function AdminOwnersPage() {
  await requireAdminPageAccess("/admin/owners");

  const owners = await prisma.user.findMany({
    where: { role: Role.OWNER },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      bookings: { select: { id: true } },
    },
  });

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

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4 font-semibold">Nom</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Inscription</th>
                  <th className="px-5 py-4 font-semibold">Réservations</th>
                  <th className="px-5 py-4 font-semibold">Fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {owners.map((owner) => (
                  <tr key={owner.id} className="align-top">
                    <td className="px-5 py-4 font-medium text-slate-900">{owner.name?.trim() || "—"}</td>
                    <td className="px-5 py-4 text-slate-700">{owner.email}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(owner.createdAt)}</td>
                    <td className="px-5 py-4 text-slate-600">{owner.bookings.length}</td>
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
          {owners.length === 0 ? <div className="border-t border-slate-200 px-5 py-6 text-sm text-slate-600">Aucun propriétaire trouvé.</div> : null}
        </section>
      </div>
    </AdminShell>
  );
}
