import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";
import BecomeSitterPage from "@/app/become-sitter/page";

export default async function BecomeSitterAccessPage() {
  const c = await cookies();
  const unlocked = c.get("dogsitter_invite")?.value === "ok";
  if (unlocked) {
    redirect("/become-sitter/form");
  }

  return (
    <div className="relative min-h-screen bg-white text-slate-900">
      <div className="pointer-events-none select-none blur-sm opacity-60">
        <BecomeSitterPage />
      </div>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-white/35" aria-hidden="true" />
        <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)] sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Accès restreint – Phase pilote</h1>
          <p className="mt-2 text-sm text-slate-600">
            DogShift est en phase pilote. Nous sélectionnons et validons chaque dogsitter avec soin afin de garantir une confiance maximale dès les
            premières réservations.
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Si vous avez été personnellement invité, entrez votre code pour déverrouiller le formulaire.
          </p>

          <div className="mt-6">
            <BecomeSitterAccessForm />
          </div>
        </div>
      </div>
    </div>
  );
}
