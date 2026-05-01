"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { X, FileText } from "lucide-react";

import { CGU_VERSION } from "@/lib/cguVersion";

// Affiché quand un utilisateur connecté n'a pas encore accepté la version
// actuelle des CGU. La version acceptée est stockée dans unsafeMetadata Clerk.
// Le banner se positionne AVANT le SiteHeader dans le DOM et ajuste la CSS
// variable --ds-maintenance-banner-height dont le header dépend pour son top offset.
export default function CguUpdateBanner() {
  const { isSignedIn, user } = useUser();
  const [visible, setVisible] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  // Synchronise --ds-maintenance-banner-height avec la hauteur réelle du banner via ResizeObserver
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.setProperty("--ds-maintenance-banner-height", "0px");
      return;
    }

    const el = bannerRef.current;
    if (!el) return;

    const update = () => {
      root.style.setProperty("--ds-maintenance-banner-height", `${el.getBoundingClientRect().height}px`);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      ro.disconnect();
      root.style.setProperty("--ds-maintenance-banner-height", "0px");
    };
  }, [visible]);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const accepted = (user.unsafeMetadata as Record<string, string>)?.cguVersion;
    if (accepted !== CGU_VERSION) setVisible(true);
  }, [isSignedIn, user]);

  async function accept() {
    if (!user) return;
    setAccepting(true);
    try {
      await user.update({ unsafeMetadata: { ...user.unsafeMetadata, cguVersion: CGU_VERSION } });
      // Trace dans le journal juridique (best-effort)
      void fetch("/api/audit/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cgu", version: CGU_VERSION }),
      }).catch(() => {});
      setVisible(false);
    } catch {
      setVisible(false);
    } finally {
      setAccepting(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      className="relative z-[60] w-full border-b border-black/15 bg-[#2f4d6b] px-4 py-3 text-white shadow-md"
    >
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
