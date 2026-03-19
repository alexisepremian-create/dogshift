import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminIncidentsPage() {
  await requireAdminPageAccess("/admin/incidents");

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Signalements</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Base incidents prête pour la suite</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Aucun modèle d’incident n’est encore déployé dans cette étape conservative. Cette route réserve la place pour une future gestion des signalements sans impacter la production actuelle.
          </p>
        </section>

        <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-8">
          <p className="text-sm font-semibold text-slate-900">Prochaine étape suggérée</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Ajouter un modèle dédié `AdminIncident` avec type, gravité, statut, entité liée, notes internes et historique d’actions, via une migration non destructive et documentée.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
