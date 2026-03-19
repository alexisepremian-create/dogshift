import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";

import AdminSitterApplicationsClient from "@/app/(protected)/admin/sitter-applications/AdminSitterApplicationsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminSittersApplicationsPage() {
  await requireAdminPageAccess("/admin/sitters/applications");

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dogsitters</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Candidatures phase pilote</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Cette section réutilise directement le panel de candidatures déjà en production, désormais intégré dans l’arborescence admin globale sans casser la route historique.
          </p>
        </section>

        <AdminSitterApplicationsClient />
      </div>
    </AdminShell>
  );
}
