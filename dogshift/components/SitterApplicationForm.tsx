"use client";

import { useMemo, useState } from "react";
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
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const STEP_LABELS = [
  "Infos personnelles",
  "Profil sitter",
  "Modalités",
] as const;

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

export default function SitterApplicationForm({ onSuccess }: Props) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [serverError, setServerError] = useState<string>("");

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
    formState: { errors, isSubmitting },
  } = useForm<SitterApplicationV2>({
    resolver: zodResolver(sitterApplicationSchemaV2),
    mode: "onTouched",
    shouldFocusError: true,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
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

  async function handleNext() {
    setServerError("");
    const fields =
      step === 0 ? STEP_1_FIELDS : step === 1 ? STEP_2_FIELDS : [];
    if (fields.length === 0) return;
    const ok = await trigger([...fields], { shouldFocus: true });
    if (ok) setStep((s) => Math.min(2, s + 1));
  }

  function handlePrev() {
    setServerError("");
    setStep((s) => Math.max(0, s - 1));
  }

  const onSubmit = handleSubmit(async (data) => {
    setServerError("");
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
      } | null;
      if (!res.ok || !json?.ok) {
        const msg =
          typeof json?.message === "string" && json.message.trim()
            ? json.message.trim()
            : "Impossible d'envoyer la candidature.";
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
  });

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

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-6">
      <Stepper steps={STEP_LABELS} current={step} />

      {/* ------------------------------------------------------------------ */}
      {/* STEP 1 — Personal infos                                             */}
      {/* ------------------------------------------------------------------ */}
      {step === 0 ? (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" required error={errors.firstName?.message}>
              <TextInput
                {...register("firstName")}
                autoComplete="given-name"
                invalid={Boolean(errors.firstName)}
              />
            </Field>
            <Field label="Nom" required error={errors.lastName?.message}>
              <TextInput
                {...register("lastName")}
                autoComplete="family-name"
                invalid={Boolean(errors.lastName)}
              />
            </Field>
          </div>

          <Field label="Email" required error={errors.email?.message}>
            <TextInput
              type="email"
              autoComplete="email"
              inputMode="email"
              invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </Field>

          <Field
            label="Téléphone"
            required
            hint="Format suisse uniquement."
            error={errors.phone?.message}
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
                  invalid={Boolean(errors.phone)}
                />
              )}
            />
          </Field>

          <Field label="Âge (optionnel)" error={errors.age?.message}>
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
                  invalid={Boolean(errors.age)}
                />
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
            <Field label="Ville / Région" required error={errors.city?.message}>
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
                    invalid={Boolean(errors.city)}
                    placeholder="Choisir une ville…"
                    options={cityOptions}
                  />
                )}
              />
            </Field>
            <Field label="NPA" required error={errors.npa?.message}>
              <TextInput
                inputMode="numeric"
                placeholder="ex. 1004"
                maxLength={4}
                invalid={Boolean(errors.npa)}
                {...register("npa")}
              />
            </Field>
          </div>

          {cityValue === CITY_OTHER_VALUE ? (
            <Field
              label="Précise ta ville"
              required
              error={errors.cityOther?.message}
            >
              <TextInput
                placeholder="ex. Nyon"
                invalid={Boolean(errors.cityOther)}
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
            error={errors.linkAnimalProfession?.message}
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
                  invalid={Boolean(errors.linkAnimalProfession)}
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
              error={errors.linkAnimalProfessionOther?.message}
            >
              <TextInput
                placeholder="ex. Auxiliaire vétérinaire"
                invalid={Boolean(errors.linkAnimalProfessionOther)}
                {...register("linkAnimalProfessionOther")}
              />
            </Field>
          ) : null}

          <Field
            label="As-tu déjà gardé des chiens ?"
            required
            error={errors.gardeExperienceLevel?.message}
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
                  invalid={Boolean(errors.gardeExperienceLevel)}
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
            hint="Minimum 30 caractères. Décris les tailles, races, situations déjà rencontrées."
            error={errors.experienceText?.message}
          >
            <Textarea
              rows={4}
              placeholder="ex. tailles, races, éducation, promenades, gardes précédentes…"
              invalid={Boolean(errors.experienceText)}
              {...register("experienceText")}
            />
          </Field>

          <Field
            label="Pourquoi DogShift ?"
            required
            hint="Minimum 80 caractères. Ta motivation aide à comprendre ton profil."
            error={errors.motivationText?.message}
          >
            <Textarea
              rows={4}
              placeholder="Explique ce qui te motive à rejoindre DogShift…"
              invalid={Boolean(errors.motivationText)}
              {...register("motivationText")}
            />
          </Field>

          <Field
            label="Allergies aux animaux (optionnel)"
            error={errors.allergies?.message}
          >
            <TextInput
              placeholder="Aucune / Préciser si oui (chats, certains chiens…)"
              invalid={Boolean(errors.allergies)}
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
              errors.availabilityStructured?.message ||
              errors.availabilityStructured?.root?.message
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
            error={errors.gardeTypes?.message}
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
            error={errors.dogSizes?.message}
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
            error={errors.housingType?.message}
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
                  invalid={Boolean(errors.housingType)}
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
              error={errors.housingTypeOther?.message}
            >
              <TextInput
                placeholder="ex. Studio avec grande terrasse partagée"
                invalid={Boolean(errors.housingTypeOther)}
                {...register("housingTypeOther")}
              />
            </Field>
          ) : null}

          <Field
            label="Autres animaux à mon domicile"
            required
            error={
              errors.otherAnimals?.message || errors.otherAnimals?.root?.message
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
              error={errors.otherAnimalsDogCount?.message}
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
                    invalid={Boolean(errors.otherAnimalsDogCount)}
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
                {errors.consentInterview ? (
                  <p className="mt-1 text-center text-sm font-medium text-rose-600">
                    {errors.consentInterview.message}
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
                {errors.consentPrivacy ? (
                  <p className="mt-1 text-center text-sm font-medium text-rose-600">
                    {errors.consentPrivacy.message}
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
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)]"
          >
            Suivant
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting || status === "submitting"}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting || status === "submitting"
              ? "Envoi…"
              : "Envoyer ma candidature"}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500">DogShift – sélection manuelle / qualité.</p>
</form>
  );
}
