import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPageAccess("/admin/settings");

  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Settings</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Configuration admin</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Cette section centralisera les futurs paramètres internes: rôles admin, politiques de modération, templates d’emails internes et préférences opérationnelles.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
