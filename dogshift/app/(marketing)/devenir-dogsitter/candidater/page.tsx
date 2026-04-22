import Link from "next/link";
import { ArrowLeft, Bone, CheckCircle2, Dog, Heart } from "lucide-react";
import { auth, currentUser } from "@clerk/nextjs/server";

import SitterApplicationForm from "@/components/SitterApplicationForm";
import { clerkUserIsExistingSitter } from "@/lib/sitterApplication/existingSitter";

export const dynamic = "force-dynamic";

export default async function CandidaterPage() {
  // Resolve the signed-in Clerk user (if any) so we can either block the form
  // for existing sitters or pre-fill the email for signed-in owners.
  let isExistingSitter = false;
  let signedInEmail: string | null = null;
  try {
    const { userId } = await auth();
    if (userId) {
      const [{ isSitter, email }, clerkUser] = await Promise.all([
        clerkUserIsExistingSitter(userId),
        currentUser().catch(() => null),
      ]);
      isExistingSitter = isSitter;
      signedInEmail =
        email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? null;
    }
  } catch {
    // Swallow — unauthenticated visitors should still see the form.
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Dog
          className="absolute right-8 top-32 h-48 w-48 rotate-12 text-[#2f4d6b]/[0.06]"
          strokeWidth={1.5}
        />
        <Bone
          className="absolute bottom-32 left-8 h-36 w-36 -rotate-12 text-[#7969F0]/[0.06]"
          strokeWidth={1.5}
        />
        <Heart
          className="absolute left-10 top-24 h-32 w-32 -rotate-12 text-[#7969F0]/[0.04]"
          strokeWidth={1.5}
        />
      </div>

      <section className="relative z-10 mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        <Link
          href="/devenir-dogsitter"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour
        </Link>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.18)] sm:p-8">
          {isExistingSitter ? (
            <AlreadySitterNotice email={signedInEmail} />
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Candidature dog-sitter
              </p>
              <h1 className="mt-2 text-balance text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                Postuler pour devenir dog-sitter DogShift
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Formulaire en 3 étapes (4–6 minutes). Candidature envoyée = pas
                d&rsquo;activation automatique. Nous te recontactons si ton
                profil est retenu.
              </p>

              <div className="mt-6">
                <SitterApplicationForm defaultEmail={signedInEmail} />
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function AlreadySitterNotice({ email }: { email: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Compte dog-sitter détecté
      </div>
      <h1 className="text-balance text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        Tu es déjà dog-sitter DogShift
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        {email ? (
          <>
            Le compte <span className="font-medium text-slate-900">{email}</span>{" "}
            est déjà activé comme dog-sitter. Inutile de postuler à nouveau —
            direction ton espace sitter pour gérer ton profil et tes
            disponibilités.
          </>
        ) : (
          <>
            Ton compte est déjà activé comme dog-sitter. Inutile de postuler à
            nouveau — direction ton espace sitter pour gérer ton profil et tes
            disponibilités.
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href="/host"
          className="inline-flex items-center justify-center rounded-full bg-[#2f4d6b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24405a]"
        >
          Aller sur mon espace sitter
        </Link>
        <Link
          href="/devenir-dogsitter"
          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Retour
        </Link>
      </div>
    </div>
  );
}
