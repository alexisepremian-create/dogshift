"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { withPublicOrigin } from "@/lib/url/publicOrigin";

function normalizeEmail(input: string) {
  return input.replace(/\s+/g, "").trim().toLowerCase();
}

export default function SignUpForm() {
  const { signUp, fetchStatus } = useSignUp();
  const searchParams = useSearchParams();
  const router = useRouter();

  const next = (searchParams?.get("next") ?? "").trim();
  const redirectAfterAuth = next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login";

  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthInFlight, setOauthInFlight] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetching = fetchStatus === "fetching";
  const signUpReady = !!signUp;
  const formDisabled = !signUpReady || fetching || loading || oauthInFlight;
  const googleDisabled = !signUpReady || oauthInFlight;

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;

    const normalized = normalizeEmail(email);
    if (!normalized) {
      setError("Merci d'entrer une adresse email valide.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const { error: createError } = await (signUp as any).create({ emailAddress: normalized });
      if (createError) {
        const msg: string = createError.message ?? "";
        const isAlreadyExists = msg.toLowerCase().includes("identifier already exists");
        throw new Error(isAlreadyExists ? "Un compte existe déjà avec cet email. Connecte-toi." : (msg || "Impossible de créer le compte."));
      }

      await (signUp as any).verifications.sendEmailCode();
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const isAlreadyExists = message.toLowerCase().includes("identifier already exists");
      if (isAlreadyExists) {
        setError("Un compte existe déjà avec cet email. Connecte-toi.");
      } else {
        setError(message || "Impossible d'envoyer le lien. Réessaie.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailCodeVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || loading) return;

    const code = emailCode.replace(/\s+/g, "").trim();
    if (!code) {
      setError("Merci d'entrer le code reçu par email.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await (signUp as any).verifications.verifyEmailCode({ code });

      if ((signUp as any).status === "complete") {
        await (signUp as any).finalize({
          navigate: ({ session, decorateUrl }: { session?: any; decorateUrl: (url: string) => string }) => {
            if (session?.currentTask) {
              console.log("[SignUpForm] session task:", session.currentTask);
              return;
            }
            const url = decorateUrl(redirectAfterAuth);
            if (url.startsWith("http")) {
              window.location.href = url;
            } else {
              router.replace(url);
            }
          },
        });
        return;
      }

      setError("Inscription incomplète. Réessaie.");
      setLoading(false);
    } catch (err) {
      console.error("[SignUpForm] handleEmailCodeVerify error:", err);
      setError(err instanceof Error ? err.message : "Code invalide.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!signUp || oauthInFlight) return;

    setError(null);
    setOauthInFlight(true);
    try {
      try {
        sessionStorage.setItem("ds_oauth_after", redirectAfterAuth);
      } catch {
        /* private mode */
      }
      const { error: ssoError } = await (signUp as any).sso({
        strategy: "oauth_google",
        redirectCallbackUrl: withPublicOrigin("/auth/google"),
        redirectUrl: withPublicOrigin(redirectAfterAuth),
      });
      if (ssoError) throw new Error(ssoError.message ?? "Inscription Google impossible.");
    } catch (err) {
      console.error("[SignUpForm] handleGoogle error:", err);
      setError(err instanceof Error ? err.message : "Inscription Google impossible. Réessaie.");
    } finally {
      setOauthInFlight(false);
    }
  }

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Créer un compte</h1>
      <p className="mt-2 text-center text-sm text-slate-600">Rejoins DogShift dès maintenant.</p>

      <div className="mt-6 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => void handleGoogle()}
          disabled={googleDisabled}
          aria-busy={oauthInFlight}
          className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {!signUpReady ? "Chargement…" : oauthInFlight ? "Redirection…" : "S'inscrire avec Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {!sent ? (
          <form onSubmit={handleEmailSignUp} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={formDisabled}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="toi@exemple.com"
              />
            </div>

            {/* Required by Clerk v7 for bot protection */}
            <div id="clerk-captcha" />

            <button
              type="submit"
              disabled={formDisabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Envoi…" : "S'inscrire par e-mail"}
            </button>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        ) : (
          <form onSubmit={handleEmailCodeVerify} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="email-code">
                Code reçu par e-mail
              </label>
              <input
                id="email-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                disabled={formDisabled}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="123456"
              />
              <p className="mt-2 text-sm text-slate-600">Un code vient d'être envoyé. Vérifie ta boîte mail (et les spams).</p>
            </div>

            <button
              type="submit"
              disabled={formDisabled}
              className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Vérification…" : "Valider le code"}
            </button>

            <button
              type="button"
              disabled={formDisabled}
              onClick={() => {
                if (loading) return;
                setSent(false);
                setEmailCode("");
                setError(null);
              }}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Changer d'email
            </button>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </form>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-slate-600">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-semibold text-slate-900 hover:underline underline-offset-2">
          Se connecter
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-slate-500">
        En continuant, tu acceptes nos{" "}
        <Link href="/cgu" className="underline underline-offset-2 hover:text-slate-700">
          conditions d'utilisation
        </Link>
        .
      </p>
    </div>
  );
}
