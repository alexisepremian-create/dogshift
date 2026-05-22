"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, FileText } from "lucide-react";

import { CGU_VERSION } from "@/lib/cguVersion";

// Affiché quand un utilisateur connecté n'a pas encore accepté la version
// actuelle des CGU. La version acceptée est stockée dans unsafeMetadata Clerk.
// Le banner se positionne AVANT le SiteHeader dans le DOM et ajuste la CSS
// variable --ds-maintenance-banner-height dont le header dépend pour son top offset.
const PAYMENT_FLOW_PATHS = ["/checkout", "/paiement", "/reservation"];

// sessionStorage key used to silence the banner for the rest of the session
// after the user clicks "Fermer". Reset on full reload / new session.
// Audit 2026-05-22 (bug I6): without this flag the banner re-appeared on
// every navigation even after the user dismissed it.
const CGU_DISMISS_KEY = "ds_cgu_dismissed_v";

function isPaymentFlow(pathname: string | null) {
  if (!pathname) return false;
  return PAYMENT_FLOW_PATHS.some((p) => pathname.startsWith(p));
}

export default function CguUpdateBanner() {
  const { data: __session, status: __sessionStatus } = useSession();
  const user = __session?.user ?? null;
  const isSignedIn = __sessionStatus === "authenticated";
  const pathname = usePathname();
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
    // TODO(PR2): persist + check CGU acceptance server-side (Prisma).
    // Until then we use a sessionStorage flag (versioned by CGU_VERSION) so
    // dismissing the banner sticks for the rest of the session.
    if (typeof window !== "undefined") {
      try {
        const dismissed = window.sessionStorage.getItem(CGU_DISMISS_KEY);
        if (dismissed === String(CGU_VERSION)) {
          setVisible(false);
          return;
        }
      } catch {
        // sessionStorage may be unavailable (private mode, SSR) — fall through.
      }
    }
    setVisible(true);
  }, [isSignedIn, user]);

  function dismissForSession() {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(CGU_DISMISS_KEY, String(CGU_VERSION));
      } catch {
        // ignore — best-effort only
      }
    }
    setVisible(false);
  }

  async function accept() {
    if (!user) return;
    setAccepting(true);
    try {
      // Trace dans le journal juridique (best-effort)
      void fetch("/api/audit/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cgu", version: CGU_VERSION }),
      }).catch(() => {});
      dismissForSession();
    } catch {
      dismissForSession();
    } finally {
      setAccepting(false);
    }
  }

  if (!visible || isPaymentFlow(pathname)) return null;

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
            onClick={dismissForSession}
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
