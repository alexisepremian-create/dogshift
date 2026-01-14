import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";
import BecomeSitterFormPreview from "@/components/BecomeSitterFormPreview";

export default async function BecomeSitterPage() {
  const { userId } = await auth();
  const c = await cookies();
  const hasInvite = c.get("dogsitter_invite")?.value === "ok";
  const startHref = hasInvite ? "/become-sitter/form" : "/become-sitter/access";

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

            <div className={isAlreadySitter ? "pointer-events-none blur-sm" : ""}>
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

              <div className="mt-10 text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">DogShift est actuellement en phase pilote</h2>
                <div className="mx-auto mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                  <p>
                    Pour garantir un niveau de confiance maximal entre propriétaires et dogsitters, DogShift débute avec une sélection volontairement
                    restreinte de profils.
                  </p>
                  <p>
                    Chaque dogsitter est choisi avec soin, puis vérifié manuellement, afin d’assurer une expérience irréprochable dès les premières
                    réservations.
                  </p>
                  <p>
                    👉 Si vous avez été personnellement invité à rejoindre DogShift, vous pouvez déverrouiller le formulaire ci-dessous à l’aide de votre
                    code d’accès.
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <div className="relative">
                  {!hasInvite ? (
                    <div className="absolute left-6 top-6 z-10 inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-900 backdrop-blur">
                      Accès restreint – Phase pilote
                    </div>
                  ) : null}

                  <div className={hasInvite ? "transition-opacity" : "pointer-events-none opacity-70 transition-opacity"}>
                    <div className={hasInvite ? "" : "[filter:blur(7px)]"}>
                      <BecomeSitterFormPreview />
                    </div>
                  </div>
                </div>

                {!hasInvite ? (
                  <div className="mt-6 flex justify-center">
                    <BecomeSitterAccessForm />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
