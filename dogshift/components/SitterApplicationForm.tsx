"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import AvailabilityGrid from "@/components/form/AvailabilityGrid";
import Checkbox from "@/components/form/Checkbox";
import Field from "@/components/form/Field";
import MultiCheckboxGroup from "@/components/form/MultiCheckboxGroup";
import PhoneInput from "@/components/form/PhoneInput";
import Select from "@/components/form/Select";
import Stepper from "@/components/form/Stepper";
import TextInput from "@/components/form/TextInput";
import Textarea from "@/components/form/Textarea";
import {
  CITY_OTHER_VALUE,
  DOG_SIZE_OPTIONS,
  GARDE_EXPERIENCE_LEVEL_OPTIONS,
  GARDE_TYPE_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  LINK_ANIMAL_PROFESSION_OPTIONS,
  OTHER_ANIMAL_OPTIONS,
  TARGET_CITIES,
  emptyAvailabilityGrid,
} from "@/lib/sitterApplication/options";
import {
  STEP_1_FIELDS,
  STEP_2_FIELDS,
  sitterApplicationSchemaV2,
  type SitterApplicationV2,
} from "@/lib/sitterApplication/schema";

type Props = {
  onSuccess?: () => void;
  /**
   * Email pre-filled from the server-side Clerk session when the visitor is
   * signed in as a (non-sitter) owner. Empty otherwise.
   */
  defaultEmail?: string | null;
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

type EmailEligibilityState =
  | { kind: "ok" }
  | { kind: "checking" }
  | { kind: "blocked"; reason: string; message: string };

const INELIGIBLE_MESSAGES: Record<string, string> = {
  signed_in_as_sitter:
    "Tu es déjà dog-sitter DogShift. Inutile de postuler à nouveau — connecte-toi à ton espace sitter.",
  email_belongs_to_sitter:
    "Cette adresse email correspond déjà à un dog-sitter DogShift. Connecte-toi à ton espace sitter ou utilise une autre adresse.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEP_LABELS = [
  "Infos personnelles",
  "Profil sitter",
  "Modalités",
] as const;

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin text-white"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
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

function availabilityToText(value: SitterApplicationV2["availabilityStructured"]): string {
  const dayLabels: Record<string, string> = {
    lundi: "lun",
    mardi: "mar",
    mercredi: "mer",
    jeudi: "jeu",
    vendredi: "ven",
    samedi: "sam",
    dimanche: "dim",
  };
  const parts: string[] = [];
  for (const [day, slots] of Object.entries(value)) {
    const label = dayLabels[day] ?? day;
    if (slots.journeeEntiere) parts.push(`${label}: journée`);
    else if (slots.matin && slots.apresMidi) parts.push(`${label}: journée`);
    else if (slots.matin) parts.push(`${label}: matin`);
    else if (slots.apresMidi) parts.push(`${label}: après-midi`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

export default function SitterApplicationForm({
  onSuccess,
  defaultEmail = null,
}: Props) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [serverError, setServerError] = useState<string>("");
  const [isAdvancing, setIsAdvancing] = useState(false);
  // Gate for RED field-level error messages. We keep RHF's `errors` state
  // as-is (so reValidateMode:onChange can keep the form in sync), but we
  // only SHOW those errors once the user has actually tried to advance /
  // submit the current step. Resets on step change so a fresh step never
  // greets the user with inherited red messages.
  const [showErrors, setShowErrors] = useState(false);
  const [emailEligibility, setEmailEligibility] =
    useState<EmailEligibilityState>({ kind: "ok" });
  const topAnchorRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledOnceRef = useRef(false);

  const cityOptions = useMemo(
    () => [
      ...TARGET_CITIES.map((c) => ({ value: c, label: c })),
      { value: CITY_OTHER_VALUE, label: "Autre ville…" },
    ],
    [],
  );

  const {
    control,
    register,
    handleSubmit,
    trigger,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SitterApplicationV2>({
    resolver: zodResolver(sitterApplicationSchemaV2),
    // Only validate on explicit action (Suivant / Envoyer). reValidateMode
    // kicks in once a field already has an error so corrections clear the
    // red message as the user types — but nothing is validated pre-action.
    mode: "onSubmit",
    reValidateMode: "onChange",
    shouldFocusError: true,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: (defaultEmail ?? "").trim().toLowerCase(),
      phone: "",
      age: null,
      city: "" as unknown as SitterApplicationV2["city"],
      cityOther: "",
      npa: "",
      linkAnimalProfession: "" as unknown as SitterApplicationV2["linkAnimalProfession"],
      linkAnimalProfessionOther: "",
      gardeExperienceLevel: "" as unknown as SitterApplicationV2["gardeExperienceLevel"],
      experienceText: "",
      motivationText: "",
      allergies: "",
      availabilityStructured: emptyAvailabilityGrid(),
      gardeTypes: [],
      dogSizes: [],
      housingType: "" as unknown as SitterApplicationV2["housingType"],
      housingTypeOther: "",
      otherAnimals: { none: false, dogs: false, cats: false, others: false },
      otherAnimalsDogCount: null,
      hasCarLicense: false,
      consentInterview: false as unknown as true,
      consentPrivacy: false as unknown as true,
      company: "",
    },
  });

  const cityValue = useWatch({ control, name: "city" });
  const linkAnimalProfessionValue = useWatch({ control, name: "linkAnimalProfession" });
  const housingTypeValue = useWatch({ control, name: "housingType" });
  const otherAnimalsValue = useWatch({ control, name: "otherAnimals" });

  useEffect(() => {
    // Arriving at a new step always starts visually clean: reset the gate,
    // and also clear RHF's errors so that `reValidateMode:onChange` doesn't
    // keep stale errors hanging around from a prior submit/trigger.
    setShowErrors(false);
    clearErrors();

    // Bring the user back to the top of the form whenever they step forward
    // or backward. Skip the very first run on mount so the initial navigation
    // that originally brought them to /candidater isn't hijacked.
    if (!hasScrolledOnceRef.current) {
      hasScrolledOnceRef.current = true;
      return;
    }
    // rAF ensures the newly-rendered step content has been laid out before we
    // measure the anchor position; without it, fast step transitions can read
    // a stale bounding box and overshoot/undershoot (2 → 3 symptoms reported).
    const anchor = topAnchorRef.current;
    if (!anchor) return;
    const raf = requestAnimationFrame(() => {
      const rect = anchor.getBoundingClientRect();
      const headerOffset = 96;
      const targetTop = rect.top + window.scrollY - headerOffset;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [step, clearErrors]);

  async function checkEmailEligibility(raw: string): Promise<boolean> {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || !EMAIL_RE.test(normalized)) {
      setEmailEligibility({ kind: "ok" });
      return true;
    }
    setEmailEligibility({ kind: "checking" });
    try {
      const res = await fetch(
        `/api/sitter-applications/eligibility?email=${encodeURIComponent(normalized)}`,
        { cache: "no-store" },
      );
      // Ignore stale responses — user may have changed the email field in
      // the meantime.
      const current = (getValues("email") ?? "").trim().toLowerCase();
      if (current && current !== normalized) return true;
      if (!res.ok) {
        setEmailEligibility({ kind: "ok" });
        return true;
      }
      const json = (await res.json().catch(() => null)) as
        | { eligible?: boolean; reason?: string }
        | null;
      if (json && json.eligible === false) {
        const reason =
          typeof json.reason === "string" ? json.reason : "ineligible";
        const message =
          INELIGIBLE_MESSAGES[reason] ??
          "Cette adresse email ne peut pas être utilisée pour postuler.";
        setEmailEligibility({ kind: "blocked", reason, message });
        return false;
      }
      setEmailEligibility({ kind: "ok" });
      return true;
    } catch {
      setEmailEligibility({ kind: "ok" });
      return true;
    }
  }

  async function handleNext() {
    if (isAdvancing) return;
    setServerError("");
    const fields =
      step === 0 ? STEP_1_FIELDS : step === 1 ? STEP_2_FIELDS : [];
    if (fields.length === 0) return;
    setIsAdvancing(true);
    try {
      const ok = await trigger([...fields], { shouldFocus: true });
      if (!ok) {
        // User clicked Suivant with invalid data → reveal the red messages
        // for the current step so they know what to fix.
        setShowErrors(true);
        return;
      }
      if (step === 0) {
        // Re-probe the email right before advancing so we catch users who just
        // typed a sitter email and skipped the blur event (e.g. keyboard submit).
        const eligible = await checkEmailEligibility(getValues("email") ?? "");
        if (!eligible) return;
      }
      // Errors + showErrors are wiped by the step-change useEffect.
      setStep((s) => Math.min(2, s + 1));
    } finally {
      setIsAdvancing(false);
    }
  }

  function handlePrev() {
    setServerError("");
    setStep((s) => Math.max(0, s - 1));
  }

  const onSubmit = handleSubmit(
    async (data) => {
      setServerError("");
    // Final eligibility probe — if the signed-in session is already a sitter
    // or the typed email belongs to a sitter, block right here and surface
    // the message inline rather than fire a submit that will 409.
    const eligible = await checkEmailEligibility(data.email);
    if (!eligible) {
      setStep(0);
      return;
    }
    setStatus("submitting");
    try {
      const sp = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      const utm = getUtm(sp);

      const availabilityText = availabilityToText(data.availabilityStructured);

      // Flatten city: DB stores the chosen city (or "Autre"), cityOther holds the free text.
      const payload = {
        ...utm,
        referrer:
          typeof document !== "undefined" ? document.referrer || null : null,

        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        age: data.age ?? null,

        city: data.city,
        cityOther: data.city === CITY_OTHER_VALUE ? (data.cityOther ?? "").trim() : null,
        npa: data.npa.trim(),

        linkAnimalProfession: data.linkAnimalProfession,
        linkAnimalProfessionOther:
          data.linkAnimalProfession === "other"
            ? (data.linkAnimalProfessionOther ?? "").trim()
            : null,

        gardeExperienceLevel: data.gardeExperienceLevel,
        // Map to legacy boolean used by the admin UI: anything other than "never"
        // is counted as "already kept dogs".
        hasDogExperience: data.gardeExperienceLevel !== "never",

        experienceText: data.experienceText.trim(),
        motivationText: data.motivationText.trim(),
        allergies: (data.allergies ?? "").trim() || null,

        availabilityStructured: data.availabilityStructured,
        availabilityText,

        gardeTypes: data.gardeTypes,
        dogSizes: data.dogSizes,
        housingType: data.housingType,
        housingTypeOther:
          data.housingType === "other"
            ? (data.housingTypeOther ?? "").trim()
            : null,

        otherAnimals: data.otherAnimals,
        otherAnimalsDogCount: data.otherAnimals.dogs
          ? (data.otherAnimalsDogCount ?? null)
          : null,

        hasCarLicense: data.hasCarLicense,

        consentInterview: data.consentInterview,
        consentPrivacy: data.consentPrivacy,
        company: data.company ?? "",
      };

      const res = await fetch("/api/sitter-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey(),
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        const msg =
          typeof json?.message === "string" && json.message.trim()
            ? json.message.trim()
            : "Impossible d'envoyer la candidature.";
        if (res.status === 409 && json?.error === "ALREADY_SITTER") {
          // Surface the block inline on the email field and drop back to step 1
          // so the user sees the tailored message without scrolling.
          setEmailEligibility({
            kind: "blocked",
            reason: "email_belongs_to_sitter",
            message: msg,
          });
          setStep(0);
          setStatus("idle");
          return;
        }
        setServerError(msg);
        setStatus("error");
        return;
      }

      setStatus("success");
      onSuccess?.();
    } catch {
      setServerError("Impossible d'envoyer la candidature.");
      setStatus("error");
    }
    },
    () => {
      // Zod / RHF found validation errors → flip the gate so the red
      // messages are now visible for the fields the user left empty.
      setShowErrors(true);
    },
  );

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-emerald-900">
          Candidature envoyée.
        </p>
        <p className="mt-2 text-sm text-emerald-900/80">
          On te recontacte si ton profil est retenu.
        </p>
      </div>
    );
  }

  // `errs` is what the UI renders from. It's either the live RHF errors
  // (once the user has attempted to advance/submit) or an empty shim, so
  // nothing is shown red before the user asked for it.
  const errs = showErrors
    ? errors
    : ({} as typeof errors);

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-6">
      <div
        ref={topAnchorRef}
        aria-hidden="true"
        className="pointer-events-none -mt-4 h-0 w-full scroll-mt-24"
      />
      <Stepper steps={STEP_LABELS} current={step} />

      {/* ------------------------------------------------------------------ */}
      {/* STEP 1 — Personal infos                                             */}
      {/* ------------------------------------------------------------------ */}
      {step === 0 ? (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" required error={errs.firstName?.message}>
              <TextInput
                {...register("firstName")}
                autoComplete="given-name"
                invalid={Boolean(errs.firstName)}
              />
            </Field>
            <Field label="Nom" required error={errs.lastName?.message}>
              <TextInput
                {...register("lastName")}
                autoComplete="family-name"
                invalid={Boolean(errs.lastName)}
              />
            </Field>
          </div>

          <Field
            label="Email"
            required
            error={
              errs.email?.message ||
              (emailEligibility.kind === "blocked"
                ? emailEligibility.message
                : undefined)
            }
            hint={
              emailEligibility.kind === "checking"
                ? "Vérification de l'adresse…"
                : undefined
            }
          >
            {(() => {
              const emailField = register("email");
              return (
                <TextInput
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  invalid={
                    Boolean(errs.email) ||
                    emailEligibility.kind === "blocked"
                  }
                  {...emailField}
                  onBlur={(e) => {
                    void emailField.onBlur(e);
                    void checkEmailEligibility(e.target.value);
                  }}
                />
              );
            })()}
          </Field>

          <Field
            label="Téléphone"
            required
            hint="Format suisse uniquement."
            error={errs.phone?.message}
          >
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errs.phone)}
                />
              )}
            />
          </Field>

          <Field label="Âge (optionnel)" error={errs.age?.message}>
            <Controller
              control={control}
              name="age"
              render={({ field }) => (
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={16}
                  max={99}
                  placeholder="ex. 28"
                  value={field.value == null ? "" : String(field.value)}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") field.onChange(null);
                    else {
                      const n = Number.parseInt(raw, 10);
                      field.onChange(Number.isFinite(n) ? n : null);
                    }
                  }}
                  onBlur={field.onBlur}
                  invalid={Boolean(errs.age)}
                />
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
            <Field label="Ville / Région" required error={errs.city?.message}>
              <Controller
                control={control}
                name="city"
                render={({ field }) => (
                  <Select
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value as SitterApplicationV2["city"])
                    }
                    onBlur={field.onBlur}
                    invalid={Boolean(errs.city)}
                    placeholder="Choisir une ville…"
                    options={cityOptions}
                  />
                )}
              />
            </Field>
            <Field label="NPA" required error={errs.npa?.message}>
              <TextInput
                inputMode="numeric"
                placeholder="ex. 1004"
                maxLength={4}
                invalid={Boolean(errs.npa)}
                {...register("npa")}
              />
            </Field>
          </div>

          {cityValue === CITY_OTHER_VALUE ? (
            <Field
              label="Précise ta ville"
              required
              error={errs.cityOther?.message}
            >
              <TextInput
                placeholder="ex. Nyon"
                invalid={Boolean(errs.cityOther)}
                {...register("cityOther")}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 2 — Sitter profile                                             */}
      {/* ------------------------------------------------------------------ */}
      {step === 1 ? (
        <div className="grid gap-4">
          <Field
            label="Lien professionnel avec les animaux"
            required
            error={errs.linkAnimalProfession?.message}
          >
            <Controller
              control={control}
              name="linkAnimalProfession"
              render={({ field }) => (
                <Select
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value as SitterApplicationV2["linkAnimalProfession"],
                    )
                  }
                  onBlur={field.onBlur}
                  invalid={Boolean(errs.linkAnimalProfession)}
                  placeholder="Choisir…"
                  options={LINK_ANIMAL_PROFESSION_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              )}
            />
          </Field>

          {linkAnimalProfessionValue === "other" ? (
            <Field
              label="Précise le métier animalier"
              required
              error={errs.linkAnimalProfessionOther?.message}
            >
              <TextInput
                placeholder="ex. Auxiliaire vétérinaire"
                invalid={Boolean(errs.linkAnimalProfessionOther)}
                {...register("linkAnimalProfessionOther")}
              />
            </Field>
          ) : null}

          <Field
            label="As-tu déjà gardé des chiens ?"
            required
            error={errs.gardeExperienceLevel?.message}
          >
            <Controller
              control={control}
              name="gardeExperienceLevel"
              render={({ field }) => (
                <Select
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value as SitterApplicationV2["gardeExperienceLevel"],
                    )
                  }
                  onBlur={field.onBlur}
                  invalid={Boolean(errs.gardeExperienceLevel)}
                  placeholder="Choisir…"
                  options={GARDE_EXPERIENCE_LEVEL_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              )}
            />
          </Field>

          <Field
            label="Expérience avec les chiens"
            required
            hint="Décris les tailles, races, situations déjà rencontrées."
            error={errs.experienceText?.message}
          >
            <Textarea
              rows={4}
              placeholder="ex. tailles, races, éducation, promenades, gardes précédentes…"
              invalid={Boolean(errs.experienceText)}
              {...register("experienceText")}
            />
          </Field>

          <Field
            label="Pourquoi DogShift ?"
            required
            hint="Ta motivation aide à comprendre ton profil."
            error={errs.motivationText?.message}
          >
            <Textarea
              rows={4}
              placeholder="Explique ce qui te motive à rejoindre DogShift…"
              invalid={Boolean(errs.motivationText)}
              {...register("motivationText")}
            />
          </Field>

          <Field
            label="Allergies aux animaux (optionnel)"
            error={errs.allergies?.message}
          >
            <TextInput
              placeholder="Aucune / Préciser si oui (chats, certains chiens…)"
              invalid={Boolean(errs.allergies)}
              {...register("allergies")}
            />
          </Field>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* STEP 3 — Modalities                                                 */}
      {/* ------------------------------------------------------------------ */}
      {step === 2 ? (
        <div className="grid gap-5">
          <Field
            label="Disponibilités générales"
            required
            error={
              errs.availabilityStructured?.message ||
              errs.availabilityStructured?.root?.message
            }
          >
            <Controller
              control={control}
              name="availabilityStructured"
              render={({ field }) => (
                <AvailabilityGrid
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>

          <Field
            label="Type(s) de garde proposé(s)"
            required
            error={errs.gardeTypes?.message}
          >
            <Controller
              control={control}
              name="gardeTypes"
              render={({ field }) => (
                <MultiCheckboxGroup
                  name={field.name}
                  value={field.value ?? []}
                  onChange={(next) =>
                    field.onChange(
                      next as SitterApplicationV2["gardeTypes"],
                    )
                  }
                  options={GARDE_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              )}
            />
          </Field>

          <Field
            label="Taille(s) de chiens acceptée(s)"
            required
            error={errs.dogSizes?.message}
          >
            <Controller
              control={control}
              name="dogSizes"
              render={({ field }) => (
                <MultiCheckboxGroup
                  name={field.name}
                  value={field.value ?? []}
                  onChange={(next) =>
                    field.onChange(next as SitterApplicationV2["dogSizes"])
                  }
                  options={DOG_SIZE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  columns={2}
                />
              )}
            />
          </Field>

          <Field
            label="Type de logement"
            required
            error={errs.housingType?.message}
          >
            <Controller
              control={control}
              name="housingType"
              render={({ field }) => (
                <Select
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value as SitterApplicationV2["housingType"],
                    )
                  }
                  onBlur={field.onBlur}
                  invalid={Boolean(errs.housingType)}
                  placeholder="Choisir…"
                  options={HOUSING_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              )}
            />
          </Field>

          {housingTypeValue === "other" ? (
            <Field
              label="Précise le type de logement"
              required
              error={errs.housingTypeOther?.message}
            >
              <TextInput
                placeholder="ex. Studio avec grande terrasse partagée"
                invalid={Boolean(errs.housingTypeOther)}
                {...register("housingTypeOther")}
              />
            </Field>
          ) : null}

          <Field
            label="Autres animaux à mon domicile"
            required
            error={
              errs.otherAnimals?.message || errs.otherAnimals?.root?.message
            }
          >
            <Controller
              control={control}
              name="otherAnimals"
              render={({ field }) => (
                <div className="grid gap-2">
                  {OTHER_ANIMAL_OPTIONS.map((o) => {
                    const checked = Boolean(
                      (field.value as Record<string, boolean>)[o.value],
                    );
                    return (
                      <Checkbox
                        key={o.value}
                        cardStyle
                        checked={checked}
                        onChange={(e) => {
                          const next = {
                            ...(field.value as Record<string, boolean>),
                            [o.value]: e.target.checked,
                          };
                          // If user picks 'none', clear the others (UX sugar).
                          if (o.value === "none" && e.target.checked) {
                            next.dogs = false;
                            next.cats = false;
                            next.others = false;
                            setValue("otherAnimalsDogCount", null);
                          }
                          // If user picks anything else, drop 'none'.
                          if (o.value !== "none" && e.target.checked) {
                            next.none = false;
                          }
                          field.onChange(next);
                        }}
                        label={o.label}
                      />
                    );
                  })}
                </div>
              )}
            />
          </Field>

          {otherAnimalsValue?.dogs ? (
            <Field
              label="Combien de chiens ?"
              required
              error={errs.otherAnimalsDogCount?.message}
            >
              <Controller
                control={control}
                name="otherAnimalsDogCount"
                render={({ field }) => (
                  <TextInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    value={field.value == null ? "" : String(field.value)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") field.onChange(null);
                      else {
                        const n = Number.parseInt(raw, 10);
                        field.onChange(Number.isFinite(n) ? n : null);
                      }
                    }}
                    onBlur={field.onBlur}
                    invalid={Boolean(errs.otherAnimalsDogCount)}
                  />
                )}
              />
            </Field>
          ) : null}

          <Controller
            control={control}
            name="hasCarLicense"
            render={({ field }) => (
              <Checkbox
                cardStyle
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                label="J'ai le permis de conduire et un véhicule disponible"
              />
            )}
          />

          {/* Honeypot (spam trap) */}
          <label className="hidden" aria-hidden="true">
            Société
            <input
              tabIndex={-1}
              autoComplete="off"
              {...register("company")}
            />
          </label>

          <Controller
            control={control}
            name="consentInterview"
            render={({ field }) => (
              <div className="grid gap-1">
                <Checkbox
                  cardStyle
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                  label="J'accepte d'être contacté·e pour un court entretien."
                />
                {errs.consentInterview ? (
                  <p className="mt-1 text-center text-sm font-medium text-rose-600">
                    {errs.consentInterview.message}
                  </p>
                ) : null}
              </div>
            )}
          />

          <Controller
            control={control}
            name="consentPrivacy"
            render={({ field }) => (
              <div className="grid gap-1">
                <Checkbox
                  cardStyle
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                  label="J'accepte la politique de confidentialité et le traitement de mes données dans le cadre de cette candidature."
                />
                {errs.consentPrivacy ? (
                  <p className="mt-1 text-center text-sm font-medium text-rose-600">
                    {errs.consentPrivacy.message}
                  </p>
                ) : null}
              </div>
            )}
          />
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Server error banner                                                 */}
      {/* ------------------------------------------------------------------ */}
      {serverError ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-medium text-rose-700"
        >
          {serverError}
        </p>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Nav buttons                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={handlePrev}
            disabled={isSubmitting || status === "submitting"}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Précédent
          </button>
        ) : (
          <span />
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={isAdvancing}
            className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAdvancing ? (
              <>
                <Spinner />
                <span>Vérification…</span>
              </>
            ) : (
              <span>Suivant</span>
            )}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting || status === "submitting"}
            className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting || status === "submitting" ? (
              <>
                <Spinner />
                <span>Envoi…</span>
              </>
            ) : (
              <span>Envoyer ma candidature</span>
            )}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">DogShift – sélection manuelle / qualité.</p>
</form>
  );
}
