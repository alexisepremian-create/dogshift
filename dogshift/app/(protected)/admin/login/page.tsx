import { redirect } from "next/navigation";

import AdminLoginForm from "./AdminLoginForm";
import { getAdminAccessState } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const state = await getAdminAccessState();

  if (!state.isAuthenticated) {
    redirect(`/login?next=${encodeURIComponent("/admin/login")}`);
  }

  if (state.isAdmin) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.18)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">DogShift Admin</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Accès interne sécurisé</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Cet espace est réservé à l’administration interne de DogShift. Aucune donnée publique ni SEO n’est impactée par cette section privée.
          </p>
          <AdminLoginForm />
        </div>
      </main>
    </div>
  );
}
