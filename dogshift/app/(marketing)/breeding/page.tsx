"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PawPrint, Lock } from "lucide-react";

import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";
import BreedingHome from "@/components/native/breeding/BreedingHome";

/**
 * "Rencontres" — the dog breeding-match (Tinder-for-dogs) screen. Native-only:
 * reachable from the center FAB of the native bottom nav. On web it just points
 * users to the app.
 */
export default function BreedingPage() {
  const isNative = useIsNativeAppSync();
  const { status } = useSession();

  if (!isNative) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10">
          <PawPrint className="h-8 w-8 text-[#7c3aed]" />
        </div>
        <p className="text-lg font-semibold text-slate-900">Rencontres pour chiens</p>
        <p className="max-w-sm text-sm text-slate-500">Trouve un partenaire pour ton chien. Disponible dans l&apos;application DogShift.</p>
        <Link href="/" className="mt-2 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white">Retour à l&apos;accueil</Link>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <Lock className="h-7 w-7 text-slate-500" />
        </div>
        <p className="text-base font-semibold text-slate-900">Connecte-toi pour accéder aux rencontres</p>
        <Link href="/login" className="mt-1 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white">Se connecter</Link>
      </div>
    );
  }

  return <BreedingHome />;
}
