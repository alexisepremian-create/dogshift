import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByEmail } from "@/lib/auth/resolveDbUserId";

export default async function BecomeSitterPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="relative rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
              <p className="text-base font-semibold text-slate-900">Connexion requise</p>
              <p className="mt-2 text-sm text-slate-600">Connecte-toi pour continuer.</p>
              <Link
                href="/login"
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  const dbUser = primaryEmail
    ? await ensureDbUserByEmail({
        email: primaryEmail,
        name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
      })
    : null;

  const isAlreadySitter = dbUser
    ? Boolean(await prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { id: true } }))
    : false;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
            {isAlreadySitter ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 px-6 py-10 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
                  <p className="text-base font-semibold text-slate-900">Vous êtes déjà dogsitter</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Vous êtes déjà inscrit en tant que sitter. L’inscription n’est plus disponible pour ce compte.
                  </p>
                  <Link
                    href="/host"
                    className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                  >
                    Aller à mon espace
                  </Link>
                </div>
              </div>
            ) : null}

            <div className={isAlreadySitter ? "pointer-events-none blur-sm" : ""}>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Devenir sitter sur DogShift</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Rejoignez une communauté premium. Nous vérifions chaque profil pour garantir une expérience impeccable aux propriétaires comme aux chiens.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">1. Créez votre profil</p>
                <p className="mt-2 text-sm text-slate-600">Infos, services, disponibilité, tarifs.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">2. Vérification</p>
                <p className="mt-2 text-sm text-slate-600">Validation manuelle et recommandations.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">3. Recevez des demandes</p>
                <p className="mt-2 text-sm text-slate-600">Acceptez en toute sérénité, en 1 clic.</p>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/become-sitter/form"
                className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
              >
                Commencer
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Retour accueil
              </Link>
            </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
