import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Bienvenue sur DogShift</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Ton compte a bien été créé. Tu peux maintenant accéder à ton espace.
      </p>
      <div className="mt-6">
        <Link
          href="/account"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Continuer
        </Link>
      </div>
    </main>
  );
}
