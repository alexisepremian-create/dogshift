"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSignUp, useUser } from "@clerk/nextjs";
import MiniStepRing from "@/components/MiniStepRing";

const SERVICE_OPTIONS = ["Promenade", "Garde", "Pension"] as const;

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// Pricing rules priority:
// 1) Pension only => pricePerDay
// 2) Promenade or Garde selected (with/without Pension) => hourlyRate; if Pension also selected => + pricePerDay
// 3) No service => no pricing inputs

export default function BecomeSitterForm() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const isSignUpLoaded = !!signUp;
  const sessionStatus = !isLoaded ? "loading" : isSignedIn ? "authenticated" : "unauthenticated";
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const [termsAccepted, setTermsAccepted] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [authInlineStatus, setAuthInlineStatus] = useState<"idle" | "creating" | "needs_code" | "verifying">("idle");
  const [emailCode, setEmailCode] = useState("");

  const [firstName, setFirstName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [pricePerDay, setPricePerDay] = useState<number | null>(null);
  const [availability, setAvailability] = useState("");
  const [bio, setBio] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const isAuthBusy = authInlineStatus === "creating" || authInlineStatus === "verifying";
  const showEmailCode = authInlineStatus === "needs_code" || authInlineStatus === "verifying";

  const showPasswordMismatch = useMemo(() => {
    if (sessionStatus === "authenticated") return false;
    if (!password || !passwordConfirm) return false;
    return passwordConfirm !== password;
  }, [password, passwordConfirm, sessionStatus]);

  const isContinueLoading = useMemo(() => {
    if (formStatus === "submitting") return true;
    if (step !== 1) return false;
    if (sessionStatus === "authenticated") return false;
    return authInlineStatus === "creating" || authInlineStatus === "verifying";
  }, [authInlineStatus, formStatus, sessionStatus, step]);

  const [step2Attempted, setStep2Attempted] = useState(false);
  const [step1Attempted, setStep1Attempted] = useState(false);

  const WALK_MIN = 15;
  const WALK_MAX = 25;
  const SITTING_MIN = 18;
  const SITTING_MAX = 30;
  const DAILY_MIN = 35;
  const DAILY_MAX = 60;

  const sessionEmail = useMemo(() => {
    if (!isLoaded || !isSignedIn) return "";
    return user?.primaryEmailAddress?.emailAddress ?? "";
  }, [isLoaded, isSignedIn, user]);

  const effectiveEmail = sessionStatus === "authenticated" ? sessionEmail : email;

  async function ensureInlineSignUp(): Promise<boolean> {
    if (sessionStatus === "authenticated") return true;
    if (!isSignUpLoaded || !signUp) {
      setAuthError("Chargement… Réessaie dans un instant.");
      return false;
    }

    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) {
      setAuthError("Email et mot de passe requis.");
      return false;
    }
    if (passwordConfirm !== password) {
      setAuthError("Les mots de passe ne correspondent pas.");
      return false;
    }

    setAuthError(null);
    setAuthInlineStatus("creating");

    const clerkErrorMessages: Record<string, string> = {
      form_password_pwned: "Ce mot de passe a été trouvé dans une fuite de données. Choisis-en un autre plus unique.",
      form_identifier_exists: "Cet email est déjà utilisé. Connecte-toi ou utilise une autre adresse.",
      form_password_length_too_short: "Le mot de passe est trop court (minimum 8 caractères).",
      form_password_not_strong_enough: "Le mot de passe n’est pas assez fort. Ajoute des chiffres, majuscules ou symboles.",
      form_param_format_invalid: "Format invalide. Vérifie ton adresse email.",
      form_param_nil: "Email et mot de passe requis.",
    };

    type ClerkErrorLike = { code?: string; longMessage?: string; message?: string } | null | undefined;
    const describe = (e: ClerkErrorLike, fallback: string) => {
      if (!e) return fallback;
      const fr = e.code ? clerkErrorMessages[e.code] : undefined;
      return fr ?? e.longMessage ?? e.message ?? fallback;
    };

    try {
      const createRes = await (signUp as any).create({ emailAddress: emailTrimmed, password });
      if (createRes?.error) {
        setAuthInlineStatus("idle");
        setAuthError(describe(createRes.error, "Impossible de créer le compte. Vérifie l’email et le mot de passe."));
        return false;
      }

      if ((signUp as any).status === "complete") {
        await (signUp as any).finalize({
          navigate: ({ decorateUrl }: { decorateUrl: (url: string) => string }) => {
            const url = decorateUrl("/post-login");
            if (url.startsWith("http")) window.location.href = url;
            else router.replace(url);
          },
        });
        setAuthInlineStatus("idle");
        return true;
      }

      const sendRes = await (signUp as any).verifications.sendEmailCode();
      if (sendRes?.error) {
        setAuthInlineStatus("idle");
        console.error("[BecomeSitterForm] sendEmailCode error:", sendRes.error);
        setAuthError(describe(sendRes.error, "Impossible d’envoyer le code par email. Réessaie dans un instant."));
        return false;
      }

      setAuthInlineStatus("needs_code");
      return false;
    } catch (err) {
      setAuthInlineStatus("idle");
      console.error("[BecomeSitterForm] ensureInlineSignUp error:", err);
      const clerkErr = err as { errors?: ClerkErrorLike[] };
      setAuthError(describe(clerkErr?.errors?.[0] ?? null, "Impossible de créer le compte. Vérifie l’email et le mot de passe."));
      return false;
    }
  }

  async function resendInlineEmailCode(): Promise<void> {
    if (sessionStatus === "authenticated") return;
    if (!isSignUpLoaded || !signUp) return;
    if (authInlineStatus === "verifying") return;
    setAuthError(null);
    try {
      const res = await (signUp as any).verifications.sendEmailCode();
      if (res?.error) {
        console.error("[BecomeSitterForm] resendEmailCode error:", res.error);
        setAuthError("Impossible d’envoyer un nouveau code. Réessaie dans un instant.");
        return;
      }
      setAuthError("Nouveau code envoyé. Vérifie ta boîte mail (et les spams).");
    } catch (err) {
      console.error("[BecomeSitterForm] resendEmailCode error:", err);
      setAuthError("Impossible d’envoyer un nouveau code. Réessaie dans un instant.");
    }
  }

  async function verifyInlineEmailCode(): Promise<boolean> {
    if (sessionStatus === "authenticated") return true;
    if (!isSignUpLoaded || !signUp) return false;
    const codeTrimmed = emailCode.trim();
    if (!codeTrimmed) {
      setAuthError("Entre le code reçu par email.");
      return false;
    }

    setAuthError(null);
    setAuthInlineStatus("verifying");
    try {
      const verifyRes = await (signUp as any).verifications.verifyEmailCode({ code: codeTrimmed });
      if (verifyRes?.error) {
        setAuthInlineStatus("needs_code");
        setAuthError("Code invalide. Réessaie.");
        return false;
      }
      if ((signUp as any).status === "complete") {
        await (signUp as any).finalize({
          navigate: ({ decorateUrl }: { decorateUrl: (url: string) => string }) => {
            const url = decorateUrl("/post-login");
            if (url.startsWith("http")) window.location.href = url;
            else router.replace(url);
          },
        });
        setAuthInlineStatus("idle");
        setStep(2);
        return true;
      }
      setAuthInlineStatus("needs_code");
      setAuthError("Code invalide. Réessaie.");
      return false;
    } catch (err) {
      console.error("[BecomeSitterForm] verifyEmailCode error:", err);
      setAuthInlineStatus("needs_code");
      setAuthError("Code invalide. Réessaie.");
      return false;
    }
  }

  const step1Errors = useMemo(() => {
    if (sessionStatus === "authenticated") return {};
    const errors: { email?: string; password?: string; passwordConfirm?: string } = {};
    const emailTrimmed = email.trim();
    const emailValid = /^\S+@\S+\.\S+$/.test(emailTrimmed);
    const pwValid = password.length >= 8;
    const pwConfirmValid = passwordConfirm.length > 0 && passwordConfirm === password;

    if (!emailTrimmed) errors.email = "L’e-mail est requis.";
    else if (!emailValid) errors.email = "Format email invalide.";

    if (!password) errors.password = "Le mot de passe est requis.";
    else if (!pwValid) errors.password = "Minimum 8 caractères.";

    if (!passwordConfirm) errors.passwordConfirm = "Confirmez votre mot de passe.";
    else if (!pwConfirmValid) errors.passwordConfirm = "Les mots de passe ne correspondent pas.";

    return errors;
  }, [email, password, passwordConfirm, sessionStatus]);

  const canNext1 = useMemo(() => {
    const hasIdentity = firstName.trim().length > 0 && city.trim().length > 0;
    if (sessionStatus === "authenticated") return hasIdentity;
    const hasAuthErrors = Boolean(step1Errors.email || step1Errors.password || step1Errors.passwordConfirm);
    return hasIdentity && !hasAuthErrors;
  }, [firstName, city, step1Errors, sessionStatus]);
  const serviceFlags = useMemo(() => {
    const walk = services.includes("Promenade");
    const sitting = services.includes("Garde");
    const boarding = services.includes("Pension");
    return { walk, sitting, boarding };
  }, [services]);

  const pricingVisibility = useMemo(() => {
    const needsHourly = serviceFlags.walk || serviceFlags.sitting;
    const needsDaily = serviceFlags.boarding;
    return {
      showNoneSelectedHint: !needsHourly && !needsDaily,
      showHourlyRate: needsHourly,
      showPricePerDay: needsDaily,
      showPricePerDayAsBoardingOnly: needsDaily && !needsHourly,
      showPricePerDayAsBoardingSecondary: needsDaily && needsHourly,
    };
  }, [serviceFlags]);

  const hourlyMin = serviceFlags.walk && serviceFlags.sitting
    ? Math.min(WALK_MIN, SITTING_MIN)
    : serviceFlags.walk ? WALK_MIN : SITTING_MIN;
  const hourlyMax = serviceFlags.walk && serviceFlags.sitting
    ? Math.max(WALK_MAX, SITTING_MAX)
    : serviceFlags.walk ? WALK_MAX : SITTING_MAX;

  const step2Errors = useMemo(() => {
    const errors: { hourlyRate?: string; pricePerDay?: string; services?: string } = {};
    const hasAnyService = serviceFlags.walk || serviceFlags.sitting || serviceFlags.boarding;

    if (!hasAnyService) {
      errors.services = "Sélectionnez au moins un service pour définir vos tarifs.";
      return errors;
    }

    if (serviceFlags.walk || serviceFlags.sitting) {
      if (hourlyRate === null || !Number.isFinite(hourlyRate)) {
        errors.hourlyRate = "Le tarif horaire est requis.";
      } else if (hourlyRate < hourlyMin) {
        errors.hourlyRate = `Tarif trop bas — minimum ${hourlyMin} CHF/h pour la phase pilote.`;
      } else if (hourlyRate > hourlyMax) {
        errors.hourlyRate = `Tarif trop élevé — maximum ${hourlyMax} CHF/h pour la phase pilote.`;
      }
    }

    if (serviceFlags.boarding) {
      if (pricePerDay === null || !Number.isFinite(pricePerDay)) {
        errors.pricePerDay = "Le prix par jour est requis.";
      } else if (pricePerDay < DAILY_MIN) {
        errors.pricePerDay = `Tarif trop bas — minimum ${DAILY_MIN} CHF/jour pour la phase pilote.`;
      } else if (pricePerDay > DAILY_MAX) {
        errors.pricePerDay = `Tarif trop élevé — maximum ${DAILY_MAX} CHF/jour pour la phase pilote.`;
      }
    }

    return errors;
  }, [serviceFlags, hourlyRate, pricePerDay, hourlyMin, hourlyMax, DAILY_MIN, DAILY_MAX]);

  const canNext2 = useMemo(() => {
    const hasErrors = Boolean(step2Errors.hourlyRate || step2Errors.pricePerDay || step2Errors.services);
    return !hasErrors && availability.trim().length > 0;
  }, [step2Errors, availability]);
  const canSubmit = useMemo(() => bio.trim().length > 0, [bio]);

  function toggleService(svc: string) {
    setServices((prev) => (prev.includes(svc) ? prev.filter((x) => x !== svc) : [...prev, svc]));
  }

  function sanitizeRateInput(raw: string, max: number): { value: number | null } {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) return { value: null };
    const parsed = Number.parseInt(cleaned, 10);
    if (!Number.isFinite(parsed)) return { value: null };
    if (parsed > max) return { value: max };
    return { value: parsed };
  }

  async function onSubmit() {
    setFormStatus("submitting");

    if (sessionStatus !== "authenticated") {
      setFormStatus("error");
      return;
    }

    if (!termsAccepted) {
      setFormStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/become-sitter/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          city,
          email: effectiveEmail,
          services,
          hourlyRate,
          pricePerDay,
          availability,
          bio,
          avatarDataUrl,
          termsAccepted: true,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { code?: string } | null;
        if (res.status === 401 && json?.code === "AUTH_REQUIRED") {
          setAuthError("Connecte-toi ou crée un compte pour finaliser.");
        }
        setFormStatus("error");
        return;
      }
    } catch {
      setFormStatus("error");
      return;
    }

    router.push("/host");
  }

  if (formStatus === "done") {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Votre compte sitter est prêt</h1>
        <p className="mt-3 text-sm text-slate-600">
          Votre profil sitter a été créé. Vous pouvez maintenant accéder à votre espace.
        </p>
        <button
          type="button"
          onClick={() => router.push("/host")}
          className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
        >
          Accéder à mon espace
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
      {!termsAccepted ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 sm:py-8" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Modal" disabled />
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_25px_80px_-45px_rgba(2,6,23,0.6)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Règlement / CGU sitter</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Avant de créer votre profil</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Pour devenir dogsitter sur DogShift, vous devez lire et accepter le règlement et les CGU sitters.
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <Link href="/cgu" className="text-sm font-semibold text-[var(--dogshift-blue)]" target="_blank" rel="noreferrer">
                Lire les CGU
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setTermsAccepted(true)}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
            >
              J’accepte
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Créer votre profil dogsitter</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Profil vérifié manuellement. Soyez précis, cela aide à vous mettre en avant.
          </p>
        </div>
        <MiniStepRing current={step} total={3} className="self-end sm:self-auto" />
      </div>

      {sessionStatus === "authenticated" ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Connecté</p>
          <p className="mt-1 text-sm text-slate-600">{sessionEmail || "Session active"}</p>
        </div>
      ) : null}

      <div className="mt-8 space-y-6">
        {step === 1 ? (
          <div className="space-y-5">
            {sessionStatus !== "authenticated" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    value={effectiveEmail}
                    disabled={formStatus === "submitting" || isAuthBusy}
                    onChange={(e) => {
                      setAuthError(null);
                      setEmail(e.target.value);
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                    placeholder="e-mail@exemple.com"
                    autoComplete="email"
                  />
                  {step1Errors.email ? <p className="mt-2 text-xs font-medium text-rose-600">{step1Errors.email}</p> : null}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Mot de passe
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="password"
                      value={password}
                      onChange={(e) => {
                        setAuthError(null);
                        setPassword(e.target.value);
                      }}
                      disabled={formStatus === "submitting" || isAuthBusy}
                      className={
                        (step1Attempted || password.length > 0) && step1Errors.password
                          ? "w-full rounded-2xl border border-rose-300 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                          : "w-full rounded-2xl border border-slate-300 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                      }
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {(step1Attempted || password.length > 0) && step1Errors.password ? <p className="mt-2 text-xs font-medium text-rose-600">{step1Errors.password}</p> : null}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="passwordConfirm" className="block text-sm font-medium text-slate-700">
                    Confirmer mot de passe
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="passwordConfirm"
                      value={passwordConfirm}
                      onChange={(e) => {
                        setAuthError(null);
                        setPasswordConfirm(e.target.value);
                      }}
                      disabled={formStatus === "submitting" || isAuthBusy}
                      className={
                        showPasswordMismatch || ((step1Attempted || passwordConfirm.length > 0) && step1Errors.passwordConfirm)
                          ? "w-full rounded-2xl border border-rose-300 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                          : "w-full rounded-2xl border border-slate-300 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                      }
                      placeholder="••••••••"
                      type={showPasswordConfirm ? "text" : "password"}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPasswordConfirm((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                      aria-label={showPasswordConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPasswordConfirm ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {showPasswordMismatch ? (
                    <p className="mt-2 text-xs font-medium text-rose-600">Les mots de passe ne correspondent pas.</p>
                  ) : (step1Attempted || passwordConfirm.length > 0) && step1Errors.passwordConfirm ? (
                    <p className="mt-2 text-xs font-medium text-rose-600">{step1Errors.passwordConfirm}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div id="clerk-captcha" />

            {authError ? <p className="text-sm font-medium text-rose-600">{authError}</p> : null}

            {sessionStatus !== "authenticated" && showEmailCode ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Vérifie ton email</p>
                <p className="mt-2 text-sm text-slate-600">
                  Un code vient d’être envoyé à <span className="font-medium text-slate-900">{email}</span>. Entre-le ci-dessous (vérifie aussi tes spams).
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                    placeholder="Code email"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={isAuthBusy}
                  />
                  <button
                    type="button"
                    onClick={() => void verifyInlineEmailCode()}
                    disabled={isAuthBusy}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {authInlineStatus === "verifying" ? "Vérification…" : "Valider"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void resendInlineEmailCode()}
                  disabled={isAuthBusy}
                  className="mt-3 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Renvoyer le code
                </button>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
                Prénom
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                placeholder="Ex. Inès"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-slate-700">
                Ville
              </label>
              <input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                placeholder="Ex. Genève"
                autoComplete="address-level2"
              />
            </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-slate-700">Services proposés</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SERVICE_OPTIONS.map((svc) => {
                  const active = services.includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => toggleService(svc)}
                      className={
                        active
                          ? "rounded-full bg-[var(--dogshift-blue)] px-4 py-2 text-xs font-semibold text-white shadow-sm"
                          : "rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm md:hover:bg-slate-50"
                      }
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="min-h-[170px]">
                <div className="mb-3 flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-700">
                    i
                  </span>
                  <p>
                    <span className="font-semibold text-slate-700">Tarifs encadrés</span>
                    <br />
                    {/* Tarifs encadrés durant le lancement */}
                    Afin de garantir une expérience équitable et cohérente, les tarifs sont encadrés durant le lancement.
                    Ils pourront évoluer librement après la validation de votre profil.
                  </p>
                </div>

                {pricingVisibility.showNoneSelectedHint ? (
                  <p className="text-sm font-medium text-slate-600">
                    Sélectionnez au moins un service pour définir vos tarifs.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {pricingVisibility.showHourlyRate ? (
                      <div>
                        <label htmlFor="hourlyRate" className="block text-sm font-medium text-slate-700">
                          Tarif horaire (CHF)
                        </label>
                        <p className="mt-0.5 text-xs text-slate-500">Phase pilote : {hourlyMin}–{hourlyMax} CHF/h</p>
                        <input
                          id="hourlyRate"
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={hourlyMin}
                          max={hourlyMax}
                          step={1}
                          value={hourlyRate ?? ""}
                          placeholder={`${hourlyMin}–${hourlyMax}`}
                          onChange={(e) => {
                            const next = sanitizeRateInput(e.target.value, 999);
                            setHourlyRate(next.value);
                          }}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                        />
                        {step2Errors.hourlyRate ? (
                          <p className="mt-2 text-xs font-medium text-rose-600">{step2Errors.hourlyRate}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {pricingVisibility.showPricePerDay ? (
                      <div>
                        <label htmlFor="pricePerDay" className="block text-sm font-medium text-slate-700">
                          {pricingVisibility.showPricePerDayAsBoardingSecondary
                            ? "Prix par jour (CHF) — Pension"
                            : "Prix par jour (CHF)"}
                        </label>
                        <p className="mt-0.5 text-xs text-slate-500">Phase pilote : {DAILY_MIN}–{DAILY_MAX} CHF/jour</p>
                        <input
                          id="pricePerDay"
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={DAILY_MIN}
                          max={DAILY_MAX}
                          step={1}
                          value={pricePerDay ?? ""}
                          placeholder={`${DAILY_MIN}–${DAILY_MAX}`}
                          onChange={(e) => {
                            const next = sanitizeRateInput(e.target.value, 999);
                            setPricePerDay(next.value);
                          }}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                        />
                        {step2Errors.pricePerDay ? (
                          <p className="mt-2 text-xs font-medium text-rose-600">{step2Errors.pricePerDay}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {step2Errors.services ? (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-medium text-rose-600">{step2Errors.services}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="availability" className="block text-sm font-medium text-slate-700">
                Disponibilités
              </label>
              <input
                id="availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                placeholder="Ex. Soirs + week-ends"
              />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-2 w-full min-h-[140px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                placeholder="Votre expérience, votre approche, votre logement, etc."
              />
            </div>

            <div>
              <label htmlFor="avatar" className="block text-sm font-medium text-slate-700">
                Photo / avatar
              </label>
              <input
                id="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-700 md:hover:file:bg-slate-200 focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setAvatarError(null);
                    setAvatarDataUrl(null);
                    return;
                  }

                  const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
                  if (!allowed.has(file.type)) {
                    setAvatarError("Formats acceptés: PNG, JPEG, WEBP.");
                    setAvatarDataUrl(null);
                    e.target.value = "";
                    return;
                  }

                  setAvatarError(null);
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = typeof reader.result === "string" ? reader.result : null;
                    setAvatarDataUrl(result);
                  };
                  reader.onerror = () => {
                    setAvatarError("Impossible de lire le fichier. Merci de réessayer.");
                    setAvatarDataUrl(null);
                  };
                  reader.readAsDataURL(file);
                }}
              />

              {avatarError ? <p className="mt-2 text-xs font-medium text-rose-600">{avatarError}</p> : null}

              {avatarDataUrl ? (
                <div className="mt-3 flex items-center gap-3">
                  <Image
                    src={avatarDataUrl}
                    alt="Aperçu avatar"
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarDataUrl(null);
                      setAvatarError(null);
                      const el = document.getElementById("avatar") as HTMLInputElement | null;
                      if (el) el.value = "";
                    }}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition md:hover:bg-slate-50"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Optionnel (MVP). Vous pourrez l’ajouter plus tard.</p>
              )}
            </div>
          </div>
        ) : null}

        {formStatus === "error" ? <p className="text-sm font-medium text-rose-600">Une erreur est survenue. Merci de réessayer.</p> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)))}
            disabled={step === 1 || formStatus === "submitting"}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition md:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Retour
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 1) {
                  setStep1Attempted(true);
                  setAuthError(null);
                  if (!canNext1) return;

                  if (sessionStatus !== "authenticated") {
                    void (async () => {
                      const ok = await ensureInlineSignUp();
                      if (ok) setStep(2);
                    })();
                    return;
                  }
                }
                if (step === 2) setStep2Attempted(true);
                if (step === 2 && !canNext2) return;
                setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
              }}
              disabled={(step === 1 && !canNext1) || formStatus === "submitting" || isAuthBusy}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isContinueLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Chargement…
                </span>
              ) : step === 1 && sessionStatus !== "authenticated" ? (
                authInlineStatus === "needs_code" || authInlineStatus === "verifying" ? (
                  "Vérifier l’email"
                ) : (
                  "Continuer"
                )
              ) : (
                "Continuer"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!canSubmit || formStatus === "submitting" || sessionStatus !== "authenticated"}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formStatus === "submitting" ? "Envoi…" : "Soumettre"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
