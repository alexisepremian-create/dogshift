"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import BecomeSitterAccessForm from "@/components/BecomeSitterAccessForm";

type FormState = {
  firstName: string;
  lastName: string;
  city: string;
  email: string;
  phone: string;
  age: string;
  experienceText: string;
  hasDogExperience: "yes" | "no" | "";
  motivationText: string;
  availabilityText: string;
  consentInterview: boolean;
  consentPrivacy: boolean;

  // honeypot
  company: string;
};

function isValidEmail(value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isValidPhone(value: string) {
  const v = normalizePhone(value);
  if (!v) return false;
  // very permissive; accept CH formats + international
  return /^[+()\d][\d()\s-]{6,}$/.test(v);
}

function getUtm(search: URLSearchParams) {
  const read = (k: string) => {
    const v = (search.get(k) || "").trim();
    return v ? v : null;
  };
  return {
    utmSource: read("utm_source"),
    utmMedium: read("utm_medium"),
    utmCampaign: read("utm_campaign"),
    utmContent: read("utm_content"),
    utmTerm: read("utm_term"),
  };
}

function idempotencyKey() {
  try {
    const k = "ds_pilot_sitter_apply_key";
    const existing = window.localStorage.getItem(k);
    if (existing && existing.trim()) return existing.trim();
    const raw = `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(k, raw);
    return raw;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

const SELECT_BASE_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 pr-11 text-sm leading-5 text-slate-900 shadow-sm outline-none transition appearance-none [-webkit-appearance:none] [-moz-appearance:none] focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]";

export default function DevenirDogsitterPage() {
  const formRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [accessOpen, setAccessOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    city: "",
    email: "",
    phone: "",
    age: "",
    experienceText: "",
    hasDogExperience: "",
    motivationText: "",
    availabilityText: "",
    consentInterview: false,
    consentPrivacy: false,
    company: "",
  });

  const validation = useMemo(() => {
    if (!form.firstName.trim()) return { ok: false as const, error: "Prénom requis." };
    if (!form.lastName.trim()) return { ok: false as const, error: "Nom requis." };
    if (!form.city.trim()) return { ok: false as const, error: "Ville / région requise." };
    if (!isValidEmail(form.email)) return { ok: false as const, error: "Email invalide." };
    if (!isValidPhone(form.phone)) return { ok: false as const, error: "Téléphone invalide." };

    if (form.age.trim()) {
      const n = Number.parseInt(form.age.trim(), 10);
      if (!Number.isFinite(n) || n < 16 || n > 99) return { ok: false as const, error: "Âge invalide." };
    }

    if (!form.experienceText.trim()) return { ok: false as const, error: "Expérience requise." };
    if (form.hasDogExperience !== "yes" && form.hasDogExperience !== "no") {
      return { ok: false as const, error: "Merci d’indiquer si tu as déjà gardé des chiens." };
    }
    if (!form.motivationText.trim()) return { ok: false as const, error: "Motivation requise." };
    if (!form.availabilityText.trim()) return { ok: false as const, error: "Disponibilités requises." };
    if (!form.consentInterview) return { ok: false as const, error: "Merci de confirmer que tu acceptes d’être contacté." };
    if (!form.consentPrivacy) return { ok: false as const, error: "Merci d’accepter la politique de confidentialité." };

    return { ok: true as const, error: "" };
  }, [form]);

  async function submit() {
    if (status === "submitting") return;
    setError("");

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setStatus("submitting");

    try {
      const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const utm = getUtm(sp);

      const res = await fetch("/api/sitter-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey(),
        },
        body: JSON.stringify({
          ...utm,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          city: form.city.trim(),
          email: form.email.trim().toLowerCase(),
          phone: normalizePhone(form.phone),
          age: form.age.trim() ? Number.parseInt(form.age.trim(), 10) : null,
          experienceText: form.experienceText.trim(),
          hasDogExperience: form.hasDogExperience === "yes",
          motivationText: form.motivationText.trim(),
          availabilityText: form.availabilityText.trim(),
          consentInterview: form.consentInterview,
          consentPrivacy: form.consentPrivacy,
          company: form.company,
        }),
      });

      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        const msg = typeof payload?.message === "string" && payload.message.trim() ? payload.message.trim() : "Impossible d’envoyer la candidature.";
        setError(msg);
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setError("Impossible d’envoyer la candidature.");
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold text-slate-600">Phase pilote</p>
            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              DogShift recrute ses 20 premiers dog-sitters
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
              Profils sélectionnés manuellement – Phase pilote Lausanne & Riviera
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
                <p className="text-xs font-semibold text-slate-600">Nouveau sitter</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Candidater pour devenir dog-sitter</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Remplis le formulaire (2–3 minutes). Sélection manuelle.</p>
                <button
                  type="button"
                  onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]"
                >
                  Candidater maintenant
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
                <p className="text-xs font-semibold text-slate-600">Déjà sélectionné</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">Entrer ton code d’accès</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Tu as reçu un code du type DS-XXXX-XXXX ? Déverrouille ton espace sitter.</p>
                <button
                  type="button"
                  onClick={() => setAccessOpen(true)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                >
                  Entrer mon code
                </button>
              </div>
            </div>

            <div id="comment-ca-marche" className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.15)] sm:p-8">
              <h2 className="text-lg font-semibold text-slate-900">Comment ça marche</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">1. Tu candidates</p>
                  <p className="mt-2 text-sm text-slate-600">Un formulaire simple (2–3 minutes).</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">2. On analyse ton profil</p>
                  <p className="mt-2 text-sm text-slate-600">Sélection manuelle, qualité avant quantité.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">3. On te contacte si ton profil est retenu</p>
                  <p className="mt-2 text-sm text-slate-600">Mini entretien pour valider l’adéquation.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-900">4. Validation + profil activé</p>
                  <p className="mt-2 text-sm text-slate-600">Ton profil est ensuite activé sur la plateforme.</p>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
                <h2 className="text-lg font-semibold text-slate-900">Ce qu’on recherche</h2>
                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                  <p>Fiabilité</p>
                  <p>Amour des chiens</p>
                  <p>Disponibilité</p>
                  <p>Sérieux</p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.12)] sm:p-8">
                <h2 className="text-lg font-semibold text-slate-900">Avantages</h2>
                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                  <p>Revenus flexibles</p>
                  <p>Clients locaux</p>
                  <p>Paiement sécurisé</p>
                  <p>Tu choisis tes disponibilités</p>
                  <p>Plateforme suisse</p>
                </div>
              </div>
            </div>
          </div>

          <div ref={formRef} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.18)] sm:p-8">
            <p className="text-xs font-semibold text-slate-600">Candidature dog-sitter</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">Candidater</h2>
            <p className="mt-2 text-sm text-slate-600">
              Candidature envoyée = pas d’activation automatique. Nous te recontactons si ton profil est retenu.
            </p>

            {status === "success" ? (
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-semibold text-emerald-900">Candidature envoyée.</p>
                <p className="mt-2 text-sm text-emerald-900/80">On te recontacte si ton profil est retenu.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Prénom
                    <input
                      value={form.firstName}
                      onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                      autoComplete="given-name"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Nom
                    <input
                      value={form.lastName}
                      onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                      autoComplete="family-name"
                    />
                  </label>
                </div>

                <label className="text-xs font-semibold text-slate-700">
                  Ville / Région
                  <input
                    value={form.city}
                    onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    autoComplete="address-level2"
                    placeholder="ex. Lausanne"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  Email
                  <input
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    autoComplete="email"
                    inputMode="email"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  Téléphone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+41 ..."
                  />
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  Âge (optionnel)
                  <input
                    value={form.age}
                    onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                    inputMode="numeric"
                    placeholder="ex. 28"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  As-tu déjà gardé des chiens ?
                  <div className="relative mt-1">
                    <select
                      value={form.hasDogExperience}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "yes" || v === "no" || v === "") setForm((p) => ({ ...p, hasDogExperience: v }));
                      }}
                      className={SELECT_BASE_CLASS}
                    >
                      <option value="">Choisir…</option>
                      <option value="yes">Oui</option>
                      <option value="no">Non</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-slate-400" aria-hidden="true">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </div>
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  Expérience avec les chiens
                  <textarea
                    value={form.experienceText}
                    onChange={(e) => setForm((p) => ({ ...p, experienceText: e.target.value }))}
                    className="mt-1 min-h-[100px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    placeholder="ex. tailles, races, éducations, promenades, gardes…"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  Pourquoi DogShift ?
                  <textarea
                    value={form.motivationText}
                    onChange={(e) => setForm((p) => ({ ...p, motivationText: e.target.value }))}
                    className="mt-1 min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  />
                </label>

                <label className="text-xs font-semibold text-slate-700">
                  Disponibilités générales
                  <textarea
                    value={form.availabilityText}
                    onChange={(e) => setForm((p) => ({ ...p, availabilityText: e.target.value }))}
                    className="mt-1 min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    placeholder="ex. semaine soir, week-ends, pension en semaine…"
                  />
                </label>

                <label className="hidden" aria-hidden="true">
                  Société
                  <input value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} tabIndex={-1} />
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.consentInterview}
                    onChange={(e) => setForm((p) => ({ ...p, consentInterview: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>J’accepte d’être contacté pour un court entretien.</span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.consentPrivacy}
                    onChange={(e) => setForm((p) => ({ ...p, consentPrivacy: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>
                    J’accepte la politique de confidentialité et le traitement de mes données dans le cadre de cette candidature.
                  </span>
                </label>

                <button
                  type="button"
                  disabled={status === "submitting"}
                  onClick={() => void submit()}
                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "submitting" ? "Envoi…" : "Envoyer ma candidature"}
                </button>

                <p className="text-xs text-slate-500">DogShift – sélection manuelle / qualité.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {accessOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Fermer"
            onClick={() => setAccessOpen(false)}
          />
          <div className="relative z-10">
            <div className="absolute -right-2 -top-2">
              <button
                type="button"
                onClick={() => setAccessOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <BecomeSitterAccessForm onUnlocked={() => setAccessOpen(false)} />
          </div>
        </div>
      ) : null}
    </main>
  );
}
