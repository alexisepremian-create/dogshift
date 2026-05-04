import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPageAccess } from "@/lib/adminAuth";
import AdminPensionVerificationsClient from "./AdminPensionVerificationsClient";

export const dynamic = "force-dynamic";

export default async function AdminPensionVerificationsPage() {
  await requireAdminPageAccess("/admin/pension-verifications");
  return (
    <AdminShell>
      <div className="grid gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Administration</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Vérifications Pension</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            Gérez les demandes de vérification de logement pour l&apos;activation du service Pension.
            L&apos;IA analyse automatiquement les photos — vous pouvez confirmer ou annuler sa décision.
          </p>
        </section>
        <AdminPensionVerificationsClient />
      </div>
    </AdminShell>
  );
}
