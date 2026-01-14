"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import MiniStepRing from "@/components/MiniStepRing";

const SERVICE_OPTIONS = ["Promenade", "Garde", "Pension"] as const;

// Pricing rules priority:
// 1) Pension only => pricePerDay
// 2) Promenade or Garde selected (with/without Pension) => hourlyRate; if Pension also selected => + pricePerDay
// 3) No service => no pricing inputs

export default function BecomeSitterForm() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const sessionStatus = !isLoaded ? "loading" : isSignedIn ? "authenticated" : "unauthenticated";
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const [authError, setAuthError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number | null>(35);
  const [pricePerDay, setPricePerDay] = useState<number | null>(70);
  const [availability, setAvailability] = useState("");
  const [bio, setBio] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [step2Attempted, setStep2Attempted] = useState(false);
  const [step1Attempted, setStep1Attempted] = useState(false);

  const HOURLY_MIN = 20;
  const HOURLY_MAX = 40;
  const DAILY_MIN = 70;
  const DAILY_MAX = 140;

  const sessionEmail = useMemo(() => {
    if (!isLoaded || !isSignedIn) return "";
    return user?.primaryEmailAddress?.emailAddress ?? "";
  }, [isLoaded, isSignedIn, user]);

  const effectiveEmail = sessionStatus === "authenticated" ? sessionEmail : email;

  const step1Errors = useMemo(() => {
    if (sessionStatus === "authenticated") return {};
    const errors: { email?: string; password?: string; passwordConfirm?: string } = {};
    const emailTrimmed = email.trim();
    const emailValid = /^\S+@\S+\.\S+$/.test(emailTrimmed);
    const pwValid = password.length >= 8;
    const pwConfirmValid = passwordConfirm.length > 0 && passwordConfirm === password;

    if (!emailTrimmed) errors.email = "L’email est requis.";
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
      } else if (hourlyRate < HOURLY_MIN || hourlyRate > HOURLY_MAX) {
        errors.hourlyRate = `Tarif autorisé entre ${HOURLY_MIN} et ${HOURLY_MAX} CHF`;
      }
    }

    if (serviceFlags.boarding) {
      if (pricePerDay === null || !Number.isFinite(pricePerDay)) {
        errors.pricePerDay = "Le prix par jour est requis.";
      } else if (pricePerDay < DAILY_MIN || pricePerDay > DAILY_MAX) {
        errors.pricePerDay = `Tarif autorisé entre ${DAILY_MIN} et ${DAILY_MAX} CHF`;
      }
    }

    return errors;
  }, [serviceFlags, hourlyRate, pricePerDay, HOURLY_MIN, HOURLY_MAX, DAILY_MIN, DAILY_MAX]);

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
        }),
      });
      if (!res.ok) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Créer votre profil dogsitter</h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Profil vérifié manuellement. Soyez précis, cela aide à vous mettre en avant.
          </p>
        </div>
        <MiniStepRing current={step} total={3} className="self-end sm:self-auto" />
      </div>

      <div className="mt-8 space-y-6">
        {step === 1 ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  value={effectiveEmail}
                  disabled={sessionStatus === "authenticated" || formStatus === "submitting"}
                  onChange={(e) => {
                    if (sessionStatus === "authenticated") return;
                    setAuthError(null);
                    setEmail(e.target.value);
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  placeholder="email@exemple.com"
                  autoComplete="email"
                />
                {step1Errors.email ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">{step1Errors.email}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Mot de passe
                </label>
                <input
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setAuthError(null);
                    setPassword(e.target.value);
                  }}
                  className={
                    step1Attempted && step1Errors.password
                      ? "mt-2 w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                      : "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                  }
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                />
                {step1Attempted && step1Errors.password ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">{step1Errors.password}</p>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-slate-700">
                  Confirmer mot de passe
                </label>
                <input
                  id="passwordConfirm"
                  value={passwordConfirm}
                  onChange={(e) => {
                    setAuthError(null);
                    setPasswordConfirm(e.target.value);
                  }}
                  className={
                    step1Attempted && step1Errors.passwordConfirm
                      ? "mt-2 w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                      : "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                  }
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                />
                {step1Attempted && step1Errors.passwordConfirm ? (
                  <p className="mt-2 text-xs font-medium text-rose-600">{step1Errors.passwordConfirm}</p>
                ) : null}
              </div>
            </div>

            {authError ? <p className="text-sm font-medium text-rose-600">{authError}</p> : null}

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
                          : "rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
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
                        <input
                          id="hourlyRate"
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={HOURLY_MIN}
                          max={HOURLY_MAX}
                          step={1}
                          value={hourlyRate ?? ""}
                          onChange={(e) => {
                            const next = sanitizeRateInput(e.target.value, HOURLY_MAX);
                            setHourlyRate(next.value);
                          }}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                        />
                        {step2Attempted && step2Errors.hourlyRate ? (
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
                        <input
                          id="pricePerDay"
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min={DAILY_MIN}
                          max={DAILY_MAX}
                          step={1}
                          value={pricePerDay ?? ""}
                          onChange={(e) => {
                            const next = sanitizeRateInput(e.target.value, DAILY_MAX);
                            setPricePerDay(next.value);
                          }}
                          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
                        />
                        {step2Attempted && step2Errors.pricePerDay ? (
                          <p className="mt-2 text-xs font-medium text-rose-600">{step2Errors.pricePerDay}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {step2Attempted && step2Errors.services ? (
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
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
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
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
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
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                }
                if (step === 2) setStep2Attempted(true);
                if (step === 2 && !canNext2) return;
                setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
              }}
              disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || formStatus === "submitting"}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continuer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!canSubmit || formStatus === "submitting"}
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
