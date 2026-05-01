"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { X, Gift, ArrowRight, CheckCircle2 } from "lucide-react";

const DISMISSED_KEY = "ds_lead_magnet_dismissed";
const SHOW_DELAY_MS = 3_500;

type Status = "idle" | "loading" | "success" | "error";

/**
 * Lead-magnet modal — email capture for a free dog-sitting guide.
 *
 * Visibility rules:
 *   - Hidden if localStorage key `ds_lead_magnet_dismissed` is set
 *   - Hidden for users whose account has hasSitterProfile === true
 *   - Shown to unauthenticated visitors + authenticated owners/visitors
 */
export default function LeadMagnetBanner() {
  const { isLoaded, isSignedIn } = useUser();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY)) return;

    async function checkAndSchedule() {
      if (isSignedIn) {
        try {
          const res = await fetch("/api/account/context");
          const data = (await res.json()) as { hasSitterProfile?: boolean };
          // Hide permanently for sitters — they don't need owner-focused lead magnets
          if (data.hasSitterProfile === true) return;
        } catch {
          // On network error, default to showing (safest UX)
        }
      }
      timerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }

    void checkAndSchedule();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoaded, isSignedIn]);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "loading" || status === "success") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "homepage_banner" }),
      });
      if (res.ok) {
        setStatus("success");
        // Auto-dismiss after success
        setTimeout(dismiss, 2_800);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (!visible) return null;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center px-4 pb-6 sm:pb-0"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Top accent band */}
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-violet-700" />

        {/* Close button */}
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute top-3.5 right-3.5 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={18} />
        </button>

        <div className="px-7 pt-6 pb-7">
          {/* Icon + headline */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 ring-1 ring-violet-200">
              <Gift size={22} className="text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-0.5">
                Guide gratuit
              </p>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">
                5 erreurs à éviter quand vous confiez votre chien
              </h2>
            </div>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed mb-5">
            Recevez immédiatement notre guide des propriétaires avisés&nbsp;: comment choisir,
            vérifier et faire confiance à un dog-sitter en toute sérénité.
          </p>

          {status === "success" ? (
            <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3.5 text-sm font-medium text-green-700 ring-1 ring-green-200">
              <CheckCircle2 size={18} className="shrink-0 text-green-500" />
              Guide envoyé ! Vérifiez votre boîte mail.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:gap-2">
              <input
                type="email"
                required
                placeholder="votre@email.ch"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                disabled={status === "loading"}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-95 disabled:opacity-60"
              >
                {status === "loading" ? (
                  "Envoi…"
                ) : (
                  <>
                    Recevoir
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          )}

          {status === "error" && (
            <p className="mt-2 text-xs text-red-500">
              Une erreur s&apos;est produite. Réessayez dans un instant.
            </p>
          )}

          <p className="mt-3.5 text-center text-[11px] text-slate-400">
            Pas de spam. Désabonnement en un clic.
          </p>
        </div>
      </div>
    </div>
  );
}
