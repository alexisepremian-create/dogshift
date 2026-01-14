import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-[calc(100vh-120px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.18)] sm:px-8 sm:py-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Bienvenue sur DogShift</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Ton compte a bien été créé. Tu peux maintenant accéder à ton espace.
          </p>

          <div className="mt-6 w-full">
            <Link
              href="/account"
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Continuer
            </Link>

            <p className="mt-4 text-xs text-slate-500">
              En utilisant DogShift, tu acceptes nos{" "}
              <Link href="/cgu" className="underline underline-offset-2 hover:text-slate-700">
                conditions d’utilisation
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
