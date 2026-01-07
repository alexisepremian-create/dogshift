"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const next = (searchParams?.get("next") ?? "").trim();
  const callbackUrlRaw = (searchParams?.get("callbackUrl") ?? "").trim();
  const callbackUrl = (() => {
    if (!callbackUrlRaw) return "";
    try {
      const u = new URL(callbackUrlRaw, window.location.origin);
      if (u.origin !== window.location.origin) return "";
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return callbackUrlRaw.startsWith("/") ? callbackUrlRaw : "";
    }
  })();
  const errorFromQuery = (searchParams?.get("error") ?? "").trim();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googlePopupMessage, setGooglePopupMessage] = useState<string | null>(null);
  const [googlePopupRetryToken, setGooglePopupRetryToken] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    const target = next ? next : callbackUrl ? callbackUrl : "/post-login";
    router.replace(target);
  }, [status, router, next, callbackUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!errorFromQuery) return;
    if (errorFromQuery === "CredentialsSignin") {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    if (errorFromQuery === "GOOGLE_ONLY") {
      setError(
        "Ce compte est lié à Google.\nConnectez-vous avec Google. Vous pourrez ajouter un mot de passe plus tard dans les paramètres."
      );
      return;
    }
    setError(errorFromQuery);
  }, [errorFromQuery]);

  async function signInWithGooglePopup() {
    setGooglePopupMessage("Ouverture de la fenêtre Google…");

    const width = 520;
    const height = 700;
    const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;

    const left = Math.max(0, Math.round(viewportWidth / 2 - width / 2 + dualScreenLeft));
    const top = Math.max(0, Math.round(viewportHeight / 2 - height / 2 + dualScreenTop));

    const popupStartUrl = new URL("/auth/google", window.location.origin);
    popupStartUrl.searchParams.set("next", next ? next : "/post-login");

    const popup = window.open(
      "about:blank",
      "dogshift-google-auth",
      `popup=yes,width=${width},height=${height},top=${top},left=${left}`
    );

    if (!popup) {
      setGooglePopupMessage("Popups bloquées. Autorisez-les pour continuer, puis réessayez.");
      return;
    }

    popup.focus();

    setGooglePopupMessage("Connexion en cours…");
    popup.location.href = popupStartUrl.toString();

    let finished = false;

    const cleanup = (intervalId: number) => {
      window.clearInterval(intervalId);
      window.removeEventListener("message", onMessage);
    };

    const finalizeSuccess = async (targetUrl?: string) => {
      if (finished) return;
      finished = true;

      setGooglePopupMessage(null);

      try {
        popup.close();
      } catch {
        // ignore
      }

      const fallbackTarget = next ? next : "/post-login";
      const target = typeof targetUrl === "string" && targetUrl.trim() ? targetUrl.trim() : fallbackTarget;
      window.location.assign(target);
    };

    const finalizeCancelled = () => {
      if (finished) return;
      finished = true;
      setGooglePopupMessage("Connexion annulée. Réessayez.");
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; next?: string } | null;
      if (!data || data.type !== "dogshift:auth-popup") return;
      void finalizeSuccess(data?.next);
    };

    window.addEventListener("message", onMessage);

    const intervalId = window.setInterval(() => {
      if (finished) {
        cleanup(intervalId);
        return;
      }

      try {
        const url = popup.location.href;
        if (url.startsWith(window.location.origin)) {
          const u = new URL(url);
          if (u.pathname === "/auth/popup") {
            cleanup(intervalId);
            void finalizeSuccess();
            return;
          }
        }
      } catch {
        // ignore cross-origin access errors
      }

      if (popup.closed) {
        cleanup(intervalId);
        finalizeCancelled();
      }
    }, 350);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Connexion</h1>
          <p className="mt-2 text-sm text-slate-600">Accédez à votre espace DogShift.</p>

          <div className="mt-8 space-y-4" aria-label="Formulaire de connexion" suppressHydrationWarning>
            {error ? (
              <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
                <div>{error}</div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                if (typeof window === "undefined") return;
                setGooglePopupRetryToken((n) => n + 1);
                void signInWithGooglePopup();
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continuer avec Google
            </button>

            {googlePopupMessage ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-medium">{googlePopupMessage}</p>
                {googlePopupMessage.toLowerCase().includes("réessayez") ||
                googlePopupMessage.toLowerCase().includes("autorisez") ? (
                  <button
                    key={googlePopupRetryToken}
                    type="button"
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      void signInWithGooglePopup();
                    }}
                    className="mt-3 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Réessayer
                  </button>
                ) : null}
              </div>
            ) : null}

            {!mounted ? null : (
              <div className="pt-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                placeholder="vous@exemple.com"
              />

              <label htmlFor="password" className="mt-4 block text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                placeholder="Votre mot de passe"
              />
              <button
                type="button"
                disabled={submitting || !email.trim() || !password}
                onClick={async () => {
                  const normalizedEmail = email.trim();
                  if (!normalizedEmail) return;

                  setSubmitting(true);
                  setError(null);

                  try {
                    await signIn("credentials", {
                      email: normalizedEmail,
                      password,
                    });
                  } catch (err) {
                    setError("Email ou mot de passe incorrect.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="mt-3 w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Se connecter
              </button>
              </div>
            )}
          </div>

          <p className="mt-6 text-sm text-slate-600">
            Pas encore de compte?{" "}
            <Link href="/register" className="font-semibold text-[var(--dogshift-blue)] hover:text-[var(--dogshift-blue-hover)]">
              Créer un compte
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
