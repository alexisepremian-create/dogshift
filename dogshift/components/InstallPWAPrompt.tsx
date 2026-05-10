"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DISMISSED_KEY = "pwa-install-dismissed";

type InstallState =
  | { status: "hidden" }
  | { status: "ios" }
  | { status: "android"; prompt: { prompt(): Promise<void> } };

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export default function InstallPWAPrompt() {
  const [state, setState] = useState<InstallState>({ status: "hidden" });

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      // setTimeout defers the setState out of the synchronous effect body,
      // satisfying the react-hooks/set-state-in-effect lint rule.
      const t = setTimeout(() => setState({ status: "ios" }), 0);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setState({ status: "android", prompt: e as unknown as { prompt(): Promise<void> } });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setState({ status: "hidden" });
  }

  async function install() {
    if (state.status !== "android") return;
    await state.prompt.prompt();
    dismiss();
  }

  if (state.status === "hidden") return null;

  return (
    <div
      role="banner"
      aria-label="Installer l'application DogShift"
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 bg-white border-t border-gray-200 shadow-lg px-4 py-3 sm:px-6"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <Image
        src="/pwa-icons/icon-72x72.png"
        alt="DogShift"
        width={40}
        height={40}
        className="rounded-lg flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          Ajouter DogShift à ton écran d&apos;accueil
        </p>
        {state.status === "ios" ? (
          <p className="text-xs text-gray-500 mt-0.5">
            Appuie sur <span className="font-medium">Partager</span> puis{" "}
            <span className="font-medium">Sur l&apos;écran d&apos;accueil</span> pour un accès rapide
          </p>
        ) : (
          <p className="text-xs text-gray-500 mt-0.5">
            Accès rapide, fonctionne hors-ligne
          </p>
        )}
      </div>

      {state.status === "android" && (
        <button
          onClick={install}
          className="flex-shrink-0 text-sm font-semibold px-3 py-1.5 rounded-lg text-white"
          style={{ backgroundColor: "var(--dogshift-blue)" }}
        >
          Installer
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Fermer"
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
