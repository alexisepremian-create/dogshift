"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";

import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();

  const force = (searchParams?.get("force") ?? "").trim();
  const forceMode = force === "1" || force.toLowerCase() === "true";

  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    if (forceMode) return;
    router.replace("/post-login");
  }, [forceMode, isLoaded, isSignedIn, router]);

  return (
    <AuthLayout>
      {isLoaded && isSignedIn && forceMode ? (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Vous êtes déjà connecté.</p>
          <p className="mt-1 text-sm text-slate-600">Pour tester un autre compte, déconnectez-vous puis reconnectez-vous.</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={switching}
              onClick={() => {
                if (switching) return;
                setSwitching(true);
                setSwitchError(null);
                try {
                  window.localStorage.removeItem("ds_auth_user");
                } catch {
                  // ignore
                }
                void clerk
                  .signOut({ redirectUrl: "/login?force=1&startGoogle=1" })
                  .catch(() => setSwitchError("Impossible de se déconnecter. Réessaie."))
                  .finally(() => setSwitching(false));
              }}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {switching ? "Déconnexion…" : "Changer de compte"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/post-login")}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              Aller à mon espace
            </button>
          </div>

          {switchError ? <p className="mt-3 text-sm font-medium text-rose-600">{switchError}</p> : null}
        </div>
      ) : null}

      <LoginForm />
    </AuthLayout>
  );
}
