import Link from "next/link";

import SitterCreateAccountForm from "@/components/SitterCreateAccountForm";

export default function SitterCreateAccountPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Compte activé
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Crée ton compte DogShift
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Ton profil dogsitter est prêt. Crée maintenant ton compte pour accéder à ton espace.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <SitterCreateAccountForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Tu as déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-[var(--dogshift-blue)] hover:underline">
            Se connecter
          </Link>
        </p>
      </main>
    </div>
  );
}
