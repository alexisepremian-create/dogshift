import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";

export default async function BecomeSitterPage() {
  const { userId } = await auth();
  const c = await cookies();
  const hasInvite = c.get("dogsitter_invite")?.value === "ok";
  const startHref = "/become-sitter/form";

  let isAlreadySitter = false;
  if (userId) {
    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    const dbUser = primaryEmail
      ? await ensureDbUserByClerkUserId({
          clerkUserId: userId,
          email: primaryEmail,
          name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
        })
      : null;

    isAlreadySitter = dbUser
      ? Boolean(await prisma.sitterProfile.findUnique({ where: { userId: dbUser.id }, select: { id: true } }))
      : false;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
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

            <div className="relative">
              <div
                className={
                  isAlreadySitter
                    ? "pointer-events-none blur-sm"
                    : !hasInvite
                      ? "pointer-events-none select-none blur-sm opacity-70"
                      : ""
                }
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
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
                    href={startHref}
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

              {!isAlreadySitter && !hasInvite ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center px-4" aria-hidden="false">
                  <div className="absolute inset-0 rounded-3xl bg-white/60 backdrop-blur-sm" aria-hidden="true" />
                  <div className="relative z-10">
                    <BecomeSitterAccessForm />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
