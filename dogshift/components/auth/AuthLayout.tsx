import type { ReactNode } from "react";

import BrandLogo from "@/components/BrandLogo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    // data-auth-layout : hooked by globals.css so the page becomes a
    // non-scrollable, full-height card in the Capacitor shell (founder
    // feedback : "dans l'onglet connexion on doit pas pouvoir scroll").
    <div
      data-auth-layout=""
      className="flex min-h-[100dvh] flex-col justify-center overflow-hidden bg-white text-slate-900"
    >
      <div className="ds-auth-enter mx-auto w-full max-w-[480px] px-6 py-10">
        <div className="flex flex-col items-center">
          <BrandLogo href="/" priority />

          <div className="mt-2 w-full">{children}</div>
        </div>

        {/* Footer separator is web-only — looks out of place in the native
            shell (founder feedback : "enlever le texte dogshift tout en bas
            avec la ligne c'est moche sur appli"). */}
        <div
          data-auth-footer=""
          className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-500"
        >
          <p>DogShift</p>
        </div>
      </div>
    </div>
  );
}
