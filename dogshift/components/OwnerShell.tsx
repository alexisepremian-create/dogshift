"use client";

import { useClerk } from "@clerk/nextjs";

import BrandLogo from "@/components/BrandLogo";
import OwnerTopNav from "@/components/OwnerTopNav";

export default function OwnerShell({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const logoutBtn =
    "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-all duration-200 ease-out hover:bg-slate-50 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="w-full overflow-visible bg-white">
        <div className="relative flex items-center justify-between px-4 py-2 sm:px-6">
          <BrandLogo href="/" />

          <div className="hidden sm:flex sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:transform sm:justify-center">
            <OwnerTopNav />
          </div>

          <button
            type="button"
            onClick={() => {
              try {
                window.localStorage.removeItem("ds_auth_user");
              } catch {
                // ignore
              }
              void clerk.signOut({ redirectUrl: "/login?force=1" });
            }}
            className={logoutBtn}
          >
            Déconnexion
          </button>
        </div>

        <div className="pb-4 sm:hidden">
          <div className="flex justify-center px-4 sm:px-6">
            <OwnerTopNav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
