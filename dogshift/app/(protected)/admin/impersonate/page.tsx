/**
 * Admin → Voir comme… (impersonation directory)
 *
 * Lists every non-admin user with a "Voir comme" button that POSTs to
 * /api/admin/impersonate/start, then redirects to the target's natural
 * dashboard (sitter → /host, owner → /account). The banner rendered in
 * `app/layout.tsx` is what tells the admin they're impersonating.
 *
 * Admins are excluded from the list — the start endpoint also refuses
 * admin targets, but filtering them out here keeps the UI honest.
 */
import { Role } from "@prisma/client";

import AdminShell from "@/components/admin/AdminShell";
import ImpersonateRowButton from "@/components/admin/ImpersonateRowButton";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value ?? "";
  return raw.trim();
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(value)
    .replaceAll(".", "-");
}

export default async function AdminImpersonatePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageAccess("/admin/impersonate");

  const sp = await searchParams;
  const q = parseQuery(sp?.q);
  const roleParam = parseQuery(sp?.role).toUpperCase();
  const role: Role | null =
    roleParam === "OWNER" || roleParam === "SITTER" ? (roleParam as Role) : null;

  const users = await prisma.user.findMany({
    where: {
      // Never list admins — impersonating another admin is forbidden by the
      // /start endpoint anyway, and showing the row would just be misleading.
      role: { not: "ADMIN" },
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      sitterId: true,
      sitterProfile: { select: { displayName: true, city: true, published: true, lifecycleStatus: true } },
    },
  });

  return (
    <AdminShell>
      <div className="space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Voir comme un utilisateur
          </h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Démarre une session d&apos;impersonation pour naviguer la plateforme en tant qu&apos;un sitter
            ou un owner. Tu peux ouvrir des pages, modifier le profil, accepter le règlement,
            mais pas envoyer de messages, déclencher Stripe ou supprimer le compte (sécurité +
            RGPD). Un bandeau rouge restera affiché en permanence — clique &laquo;&nbsp;Quitter&nbsp;&raquo;
            pour redevenir admin.
          </p>
        </header>

        <form className="flex flex-wrap items-center gap-3" method="get" action="/admin/impersonate">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Email ou nom"
            className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-500"
          />
          <select
            name="role"
            defaultValue={role ?? ""}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-500"
          >
            <option value="">Tous les rôles</option>
            <option value="OWNER">Owners</option>
            <option value="SITTER">Sitters</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrer
          </button>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Rôle</th>
                <th className="px-4 py-3 text-left">Profil sitter</th>
                <th className="px-4 py-3 text-left">Inscription</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    Aucun utilisateur ne correspond.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{u.email}</td>
                    <td className="px-4 py-3 text-slate-900">{u.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          u.role === "SITTER"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                            : "rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"
                        }
                      >
                        {u.role.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {u.sitterProfile ? (
                        <span>
                          {u.sitterProfile.city ?? "—"} ·{" "}
                          <span
                            className={
                              u.sitterProfile.published
                                ? "text-emerald-700"
                                : "text-slate-400"
                            }
                          >
                            {u.sitterProfile.published ? "publié" : "non publié"}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ImpersonateRowButton userId={u.id} targetEmail={u.email ?? ""} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Toutes les sessions d&apos;impersonation sont audit-loggées
          (action <code>admin.impersonate_start</code> + <code>admin.impersonate_stop</code>) dans
          la table <code>AuditLog</code> pour conformité RGPD/nLPD. La session expire automatiquement
          après 35 minutes.
        </p>
      </div>
    </AdminShell>
  );
}
