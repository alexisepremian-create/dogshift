"use client";

import { useSignUp, useUser } from "@clerk/nextjs";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Status = "idle" | "creating" | "needs_code" | "verifying" | "done";

const CLERK_ERROR_MESSAGES: Record<string, string> = {
  form_password_pwned:
    "Ce mot de passe a été trouvé dans une fuite de données. Choisis-en un autre plus unique.",
  form_identifier_exists:
    "Cet email est déjà utilisé. Connecte-toi plutôt à ton compte existant.",
  form_password_length_too_short:
    "Le mot de passe est trop court (minimum 8 caractères).",
  form_password_not_strong_enough:
    "Le mot de passe n'est pas assez fort. Ajoute des chiffres, majuscules ou symboles.",
  form_param_format_invalid: "Format invalide. Vérifie ton adresse email.",
  form_param_nil: "Email et mot de passe requis.",
};

type ClerkErrLike =
  | { code?: string; longMessage?: string; message?: string }
  | null
  | undefined;

function clerkMsg(e: ClerkErrLike, fallback: string) {
  if (!e) return fallback;
  const fr = e.code ? CLERK_ERROR_MESSAGES[e.code] : undefined;
  return fr ?? e.longMessage ?? e.message ?? fallback;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

export default function SitterCreateAccountForm() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { signUp } = useSignUp();

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const passwordMismatch = useMemo(
    () => !!password && !!passwordConfirm && password !== passwordConfirm,
    [password, passwordConfirm],
  );

  // Already signed in — just redirect to host
  if (isLoaded && isSignedIn) {
    router.replace("/host");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;

    const emailTrimmed = email.trim();
    const nameTrimmed = firstName.trim();
    if (!emailTrimmed || !password) {
      setError("Email et mot de passe requis.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setError(null);
    setStatus("creating");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (signUp as any).create({
        emailAddress: emailTrimmed,
        password,
        ...(nameTrimmed ? { firstName: nameTrimmed } : {}),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((signUp as any).status === "complete") {
        setStatus("done");
        router.replace("/host");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (signUp as any).prepareEmailAddressVerification({ strategy: "email_code" });
      setStatus("needs_code");
    } catch (err) {
      setStatus("idle");
       
      const clerkErr = err as { errors?: ClerkErrLike[] };
      setError(
        clerkMsg(
          clerkErr?.errors?.[0] ?? null,
          "Impossible de créer le compte. Vérifie l'email et le mot de passe.",
        ),
      );
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;

    setError(null);
    setStatus("verifying");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (signUp as any).attemptEmailAddressVerification({
        code: emailCode.trim(),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((result as any).status === "complete") {
        setStatus("done");
        router.replace("/host");
      } else {
        setStatus("needs_code");
        setError("Code invalide. Réessaie.");
      }
    } catch (err) {
      setStatus("needs_code");
       
      const clerkErr = err as { errors?: ClerkErrLike[] };
      setError(
        clerkMsg(clerkErr?.errors?.[0] ?? null, "Code incorrect. Réessaie."),
      );
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" strokeWidth={1.5} />
        <p className="text-sm font-medium text-slate-700">
          Compte créé ! Redirection vers ton espace…
        </p>
      </div>
    );
  }

  const isBusy = status === "creating" || status === "verifying";

  if (status === "needs_code" || status === "verifying") {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Un code de vérification a été envoyé à <strong>{email}</strong>. Entre-le
          ci-dessous pour finaliser la création de ton compte.
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Code de vérification
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            placeholder="123456"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
            required
            disabled={isBusy}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-60"
        >
          {isBusy && <Spinner className="h-4 w-4 animate-spin" />}
          Vérifier le code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Prénom
        </label>
        <input
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Marie"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
          disabled={isBusy}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="marie@exemple.ch"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
          required
          disabled={isBusy}
        />
        <p className="text-xs text-slate-400">
          Utilise l&apos;email sur lequel tu as reçu ton code d&apos;activation.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mot de passe <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 caractères"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
            required
            disabled={isBusy}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Masquer" : "Afficher"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Confirmer le mot de passe <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPasswordConfirm ? "text" : "password"}
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="Répète le mot de passe"
            className={`w-full rounded-xl border bg-white px-4 py-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)] ${
              passwordMismatch
                ? "border-red-400 focus:border-red-400"
                : "border-slate-200 focus:border-[var(--dogshift-blue)]"
            }`}
            required
            disabled={isBusy}
          />
          <button
            type="button"
            onClick={() => setShowPasswordConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPasswordConfirm ? "Masquer" : "Afficher"}
          >
            {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {passwordMismatch && (
          <p className="text-xs text-red-500">Les mots de passe ne correspondent pas.</p>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={isBusy || passwordMismatch}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-60"
      >
        {isBusy && <Spinner className="h-4 w-4 animate-spin" />}
        Créer mon compte
      </button>
    </form>
  );
}
