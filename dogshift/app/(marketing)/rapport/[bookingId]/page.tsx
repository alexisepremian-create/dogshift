"use client";

import { use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lock, FileText } from "lucide-react";

import { useIsNativeAppSync } from "@/lib/native/useIsNativeAppSync";
import ReportComposer from "@/components/native/serviceReport/ReportComposer";

/**
 * Service-report composer for the sitter. Native-only (reached from the camera
 * quick-attach + the selfie/report push notifications). On web we point to the
 * app; unauthenticated users are asked to sign in.
 */
export default function RapportPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params);
  const isNative = useIsNativeAppSync();
  const { status } = useSession();

  if (!isNative) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7c3aed]/10">
          <FileText className="h-8 w-8 text-[#7c3aed]" />
        </div>
        <p className="text-lg font-semibold text-slate-900">Rapport de service</p>
        <p className="max-w-sm text-sm text-slate-500">Rédige et envoie le rapport depuis l&apos;application DogShift.</p>
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
        <p className="text-base font-semibold text-slate-900">Connecte-toi pour rédiger le rapport</p>
        <Link href="/login" className="mt-1 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white">Se connecter</Link>
      </div>
    );
  }

  return <ReportComposer bookingId={bookingId} />;
}
