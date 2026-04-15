"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { X, FileText } from "lucide-react";

import { CGU_VERSION } from "@/lib/cguVersion";

// Affiché quand un utilisateur connecté n'a pas encore accepté la version
// actuelle des CGU. La version acceptée est stockée dans unsafeMetadata Clerk.
// Pour déclencher un nouveau banneau, il suffit de changer CGU_VERSION dans lib/cguVersion.ts.
export default function CguUpdateBanner() {
  const { isSignedIn, user } = useUser();
  const [visible, setVisible] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const accepted = (user.unsafeMetadata as Record<string, string>)?.cguVersion;
    if (accepted !== CGU_VERSION) {
      setVisible(true);
    }
  }, [isSignedIn, user]);

  async function accept() {
    if (!user) return;
    setAccepting(true);
    try {
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, cguVersion: CGU_VERSION } });
      setVisible(false);
    } catch {
      // fail silently, user can dismiss manually
      setVisible(false);
    } finally {
      setAccepting(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="sticky top-0 z-40 w-full bg-[#2f4d6b] px-4 py-3 text-white shadow-md">
      <div className="mx-auto flex max-w-5xl items-start gap-3 sm:items-center">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" aria-hidden="true" />

        <p className="flex-1 text-xs leading-relaxed sm:text-sm">
          <span className="font-semibold">Nos CGU ont été mises à jour.</span>{" "}
          Veuillez lire et accepter les nouvelles{" "}
          <Link href="/cgu" className="underline underline-offset-2 hover:opacity-80">
            Conditions générales d&apos;utilisation
          </Link>{" "}
          et la{" "}
          <Link href="/confidentialite" className="underline underline-offset-2 hover:opacity-80">
            politique de confidentialité
          </Link>
          .
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={accept}
            disabled={accepting}
            className="rounded-xl border border-white/40 bg-white/10 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/20 disabled:opacity-60"
          >
            {accepting ? "…" : "J'accepte"}
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Fermer"
            className="rounded-lg p-1 opacity-70 transition hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
