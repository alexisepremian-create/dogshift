import BecomeSitterForm from "@/components/BecomeSitterForm";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";

export default async function BecomeSitterFormPage() {
  const c = await cookies();
  const unlocked = c.get("ds_invite_unlocked")?.value === "1";
  if (!unlocked) {
    redirect("/become-sitter");
  }

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
    ? await ensureDbUserByClerkUserId({
        clerkUserId: userId,
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
          <div className="relative">
            {isAlreadySitter ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/70 px-6 py-10 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
                  <p className="text-base font-semibold text-slate-900">Vous êtes déjà dogsitter</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Vous êtes déjà inscrit en tant que sitter. Le formulaire n’est plus disponible pour ce compte.
                  </p>
                  <div className="mt-5 space-y-3">
                    <Link
                      href="/host"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
                    >
                      Aller à mon espace
                    </Link>
                    <Link
                      href="/become-sitter"
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                    >
                      Retour
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}

            <div className={isAlreadySitter ? "pointer-events-none blur-sm" : ""}>
              <BecomeSitterForm />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
