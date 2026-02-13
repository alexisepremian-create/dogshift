"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import SunCornerGlow from "@/components/SunCornerGlow";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Settings,
  Shield,
  User2,
} from "lucide-react";

type SettingsState = {
  notifications: {
    newMessages: boolean;
    messageReceived: boolean;
    newBookingRequest: boolean;
    bookingConfirmed: boolean;
    paymentReceived: boolean;
    bookingReminder: boolean;
  };
  preferences: {
    language: "fr" | "en" | "it";
    timeZone: string;
    dateFormat: "auto" | "dd/mm/yyyy" | "mm/dd/yyyy" | "yyyy-mm-dd";
  };
};

type MeResponse = {
  ok?: boolean;
  profile?: { firstName: string; lastName: string; email: string };
  security?: { googleConnected: boolean; emailVerified: boolean; passwordSet: boolean };
  settings?: SettingsState;
  emailVerificationStatus?: "verified" | "unverified" | "pending";
  lastVerificationEmailSentAt?: string | null;
  provider?: string;
  error?: string;
};

function strengthLabel(password: string) {
  const p = password ?? "";
  let score = 0;
  if (p.length >= 8) score += 1;
  if (/[A-Z]/.test(p)) score += 1;
  if (/[0-9]/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p)) score += 1;
  if (p.length >= 12) score += 1;

  if (p.length < 8) return { label: "Faible", tone: "rose" as const };
  if (score <= 2) return { label: "Moyen", tone: "amber" as const };
  return { label: "Fort", tone: "emerald" as const };
}

function safeTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function defaultSettings(): SettingsState {
  return {
    notifications: {
      newMessages: true,
      messageReceived: true,
      newBookingRequest: true,
      bookingConfirmed: true,
      paymentReceived: true,
      bookingReminder: true,
    },
    preferences: {
      language: "fr",
      timeZone: "",
      dateFormat: "auto",
    },
  };
}

export default function AccountSettingsPage() {
  const pathname = usePathname();
  const isHost = typeof pathname === "string" && pathname.startsWith("/host/");
  const glowVariant = isHost ? "sitterSettings" : "ownerSettings";
  const basePath = isHost ? "/host/settings" : "/account/settings";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress;

  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSnapshot, setProfileSnapshot] = useState<{ firstName: string; lastName: string }>({ firstName: "", lastName: "" });
  const [security, setSecurity] = useState<{ googleConnected: boolean; emailVerified: boolean; passwordSet: boolean } | null>(null);
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<"verified" | "unverified" | "pending">("unverified");
  const [lastVerificationEmailSentAt, setLastVerificationEmailSentAt] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [settingsState, setSettingsState] = useState<SettingsState>(defaultSettings());

  const [mounted, setMounted] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [prefsSubmitting, setPrefsSubmitting] = useState(false);

  const [notificationSavingKey, setNotificationSavingKey] = useState<keyof SettingsState["notifications"] | null>(null);
  const [notificationSavedKey, setNotificationSavedKey] = useState<keyof SettingsState["notifications"] | null>(null);

  const [emailSending, setEmailSending] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState<null | { type: "success" | "error"; message: string }>(null);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(basePath)}`);
    }
  }, [basePath, router, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let canceled = false;
    void (async () => {
      setMeLoading(true);
      setMeError(null);
      try {
        const res = await fetch("/api/account/settings/me", { method: "GET" });
        const payload = (await res.json()) as MeResponse;
        if (canceled) return;
        if (!res.ok || !payload.ok || !payload.profile || !payload.security || !payload.settings) {
          setMeError("Impossible de charger tes paramètres.");
          setMeLoading(false);
          return;
        }

        setProfileFirstName(payload.profile.firstName ?? "");
        setProfileLastName(payload.profile.lastName ?? "");
        setProfileSnapshot({
          firstName: payload.profile.firstName ?? "",
          lastName: payload.profile.lastName ?? "",
        });
        setProfileEmail(payload.profile.email ?? email ?? "");
        setSecurity(payload.security);

        setEmailVerificationStatus(payload.emailVerificationStatus ?? (payload.security.emailVerified ? "verified" : "unverified"));
        setLastVerificationEmailSentAt(payload.lastVerificationEmailSentAt ?? null);
        setProvider(typeof payload.provider === "string" ? payload.provider : null);

        const tz = payload.settings.preferences.timeZone || safeTimeZone();
        setSettingsState({
          notifications: payload.settings.notifications,
          preferences: { ...payload.settings.preferences, timeZone: tz },
        });
      } catch {
        if (canceled) return;
        setMeError("Impossible de charger tes paramètres.");
      } finally {
        if (!canceled) setMeLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [email, isLoaded, isSignedIn]);

  useEffect(() => {
    const verified = searchParams?.get("verified");
    if (verified === "1") {
      setToast("Email vérifié");
      router.refresh();
    } else if (verified === "0") {
      setToast("Lien de vérification invalide ou expiré");
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!lastVerificationEmailSentAt) {
      setCooldownSecondsLeft(0);
      return;
    }
    const ts = new Date(lastVerificationEmailSentAt).getTime();
    if (!Number.isFinite(ts)) {
      setCooldownSecondsLeft(0);
      return;
    }
    const cooldownMs = 60_000;
    const compute = () => {
      const diff = Date.now() - ts;
      const left = Math.max(0, Math.ceil((cooldownMs - diff) / 1000));
      setCooldownSecondsLeft(left);
    };
    compute();
    const i = setInterval(compute, 500);
    return () => clearInterval(i);
  }, [lastVerificationEmailSentAt]);

  useEffect(() => {
    if (!notificationSavedKey) return;
    const t = setTimeout(() => setNotificationSavedKey(null), 1000);
    return () => clearTimeout(t);
  }, [notificationSavedKey]);

  const passwordStrength = useMemo(() => strengthLabel(password), [password]);
  const passwordCanSubmit = password.length >= 8 && password === passwordConfirm && !passwordSubmitting;

  const profileDirty = useMemo(() => {
    return (
      profileFirstName.trim() !== profileSnapshot.firstName.trim() ||
      profileLastName.trim() !== profileSnapshot.lastName.trim()
    );
  }, [profileFirstName, profileLastName, profileSnapshot.firstName, profileSnapshot.lastName]);

  if (!mounted) {
    return <div className="grid gap-6" />;
  }

  const cardBase = "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8";
  const sectionTitle = "flex items-start justify-between gap-4";
  const labelBase = "block text-sm font-medium text-slate-700";
  const inputBase =
    "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] disabled:bg-slate-50 disabled:text-slate-500";

  async function saveNotificationPreference(key: keyof SettingsState["notifications"], nextValue: boolean) {
    if (notificationSavingKey) return;
    const prevValue = Boolean(settingsState.notifications[key]);

    setNotificationSavingKey(key);
    setNotificationSavedKey(null);
    setMeError(null);

    // Optimistic UI
    setSettingsState((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: nextValue },
    }));

    try {
      const res = await fetch("/api/account/settings/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: { [key]: nextValue } }),
      });
      const payload = (await res.json()) as { ok?: boolean };
      if (!res.ok || !payload.ok) {
        setSettingsState((prev) => ({
          ...prev,
          notifications: { ...prev.notifications, [key]: prevValue },
        }));
        setToast("Impossible d’enregistrer la préférence");
        return;
      }
      setNotificationSavedKey(key);
    } catch {
      setSettingsState((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, [key]: prevValue },
      }));
      setToast("Impossible d’enregistrer la préférence");
    } finally {
      setNotificationSavingKey(null);
    }
  }

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="account-settings-page">
      <SunCornerGlow variant={glowVariant} />

      <div className="relative z-10 grid gap-6">
      <div>
        <p className="text-sm font-semibold text-slate-600">Mon compte</p>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          <Settings className="h-6 w-6 text-slate-700" aria-hidden="true" />
          <span>Paramètres</span>
        </h1>
        <div className="mt-3 flex min-h-[32px] items-center">
          <p className="text-sm text-slate-600">Gérez vos informations, votre sécurité et vos préférences.</p>
        </div>
      </div>

      {toast ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-medium text-emerald-900">
          {toast}
        </div>
      ) : null}

      {meError ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-900">{meError}</div>
      ) : null}

      <div className={cardBase} suppressHydrationWarning>
        <div className={sectionTitle}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Informations personnelles</h2>
            <p className="mt-2 text-sm text-slate-600">Modifie ton nom affiché sans toucher à la sécurité.</p>
          </div>
          <User2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelBase} htmlFor="firstName">
              Prénom
            </label>
            <div className="relative" suppressHydrationWarning>
              <User2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="firstName"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                value={profileFirstName}
                disabled={meLoading || profileSubmitting}
                onChange={(e) => setProfileFirstName(e.target.value)}
                className={`${inputBase} pl-10`}
                placeholder="Votre prénom"
              />
            </div>
          </div>

          <div>
            <label className={labelBase} htmlFor="lastName">
              Nom
            </label>
            <input
              id="lastName"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              value={profileLastName}
              disabled={meLoading || profileSubmitting}
              onChange={(e) => setProfileLastName(e.target.value)}
              className={inputBase}
              placeholder="Votre nom"
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelBase} htmlFor="email">
              Email
            </label>
            <div className="relative" suppressHydrationWarning>
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input id="email" value={profileEmail} disabled className={`${inputBase} pl-10`} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Ton email est géré par ton fournisseur de connexion.</p>
          </div>
        </div>

        {profileDirty ? (
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={profileSubmitting}
              onClick={() => {
                setMeError(null);
                setProfileFirstName(profileSnapshot.firstName);
                setProfileLastName(profileSnapshot.lastName);
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={profileSubmitting}
              onClick={async () => {
                setProfileSubmitting(true);
                setMeError(null);
                try {
                  const res = await fetch("/api/account/settings/me", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ firstName: profileFirstName, lastName: profileLastName }),
                  });
                  const payload = (await res.json()) as { ok?: boolean };
                  if (!res.ok || !payload.ok) {
                    setMeError("Impossible d’enregistrer tes informations.");
                    setToast("Impossible d’enregistrer tes informations");
                    return;
                  }

                  setProfileSnapshot({ firstName: profileFirstName, lastName: profileLastName });
                  router.refresh();
                  setToast("Informations mises à jour");
                } catch {
                  setMeError("Impossible d’enregistrer tes informations.");
                  setToast("Impossible d’enregistrer tes informations");
                } finally {
                  setProfileSubmitting(false);
                }
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileSubmitting ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Vérification email</p>
              <p className="mt-1 text-sm text-slate-600">
                Vérifie ton email pour sécuriser ton compte et recevoir les notifications.
              </p>
              {provider === "google" ? (
                <p className="mt-2 text-xs text-slate-500">Compte connecté via Google — l’email est géré par ton fournisseur.</p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="Rafraîchir le statut"
                title="Rafraîchir le statut"
                disabled={meLoading}
                onClick={async () => {
                  setMeLoading(true);
                  try {
                    const res = await fetch("/api/account/settings/me", { method: "GET" });
                    const payload = (await res.json()) as MeResponse;
                    if (!res.ok || !payload.ok || !payload.security) return;
                    setSecurity(payload.security);
                    setEmailVerificationStatus(payload.emailVerificationStatus ?? (payload.security.emailVerified ? "verified" : "unverified"));
                    setLastVerificationEmailSentAt(payload.lastVerificationEmailSentAt ?? null);
                    setProvider(typeof payload.provider === "string" ? payload.provider : null);
                  } finally {
                    setMeLoading(false);
                  }
                }}
                className="group inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" aria-hidden="true" />
              </button>

              <button
                type="button"
                disabled={
                  emailSending ||
                  emailVerificationStatus === "verified" ||
                  cooldownSecondsLeft > 0 ||
                  meLoading
                }
                onClick={async () => {
                  setEmailSending(true);
                  setEmailSendStatus(null);
                  try {
                    const res = await fetch("/api/account/email-verification/send", { method: "POST" });
                    const payload = (await res.json()) as { ok?: boolean; error?: string; retryInSeconds?: number; sentAt?: string };
                    if (!res.ok || !payload.ok) {
                      if (payload.error === "ALREADY_VERIFIED") {
                        setEmailSendStatus({ type: "success", message: "Ton email est déjà vérifié." });
                        setEmailVerificationStatus("verified");
                        return;
                      }
                      if (payload.error === "COOLDOWN") {
                        setEmailSendStatus({ type: "error", message: "Réessaie dans quelques secondes." });
                        if (typeof payload.retryInSeconds === "number") {
                          const sentAt = new Date(Date.now() - (60_000 - payload.retryInSeconds * 1000)).toISOString();
                          setLastVerificationEmailSentAt(sentAt);
                        }
                        return;
                      }
                      setEmailSendStatus({
                        type: "error",
                        message: "Une erreur est survenue lors de l’envoi de l’email.",
                      });
                      return;
                    }
                    setEmailSendStatus({
                      type: "success",
                      message: "Email de vérification envoyé. Pense à vérifier tes spams.",
                    });
                    setEmailVerificationStatus("pending");
                    if (typeof payload.sentAt === "string") setLastVerificationEmailSentAt(payload.sentAt);
                  } catch {
                    setEmailSendStatus({
                      type: "error",
                      message: "Une erreur est survenue lors de l’envoi de l’email.",
                    });
                  } finally {
                    setEmailSending(false);
                  }
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {emailVerificationStatus === "verified"
                  ? "Déjà vérifié"
                  : emailSending
                    ? "Envoi…"
                    : emailVerificationStatus === "pending"
                      ? cooldownSecondsLeft > 0
                        ? `Réessaie dans ${cooldownSecondsLeft}s`
                        : "Renvoyer"
                      : "Vérifier"}
              </button>
            </div>
          </div>

          {emailSendStatus ? (
            <div
              className={
                "mt-3 rounded-2xl border px-4 py-3 text-sm " +
                (emailSendStatus.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-rose-200 bg-rose-50 text-rose-900")
              }
              role="status"
            >
              {emailSendStatus.message}
            </div>
          ) : null}
        </div>
      </div>

      <div className={cardBase} suppressHydrationWarning>
        <div className={sectionTitle}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Sécurité & connexion</h2>
            <p className="mt-2 text-sm text-slate-600">Vérifie l’état de ton compte et renforce ta sécurité.</p>
          </div>
          <Shield className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-900">Mode de connexion</p>
            <p className="text-sm font-medium text-slate-600">
              {security?.googleConnected ? "Connecté via Google" : "Compte email"}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Email vérifié</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {emailVerificationStatus === "verified"
                    ? "Vérifié"
                    : emailVerificationStatus === "pending"
                      ? "Email envoyé"
                      : "Non vérifié"}
                </p>
              </div>
              {emailVerificationStatus === "verified" ? (
                <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : null}
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Lock className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Mot de passe</p>
                <p className="mt-0.5 text-xs text-slate-500">{security?.passwordSet ? "Défini" : "Non défini"}</p>
              </div>
              {security?.passwordSet ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-hidden="true" /> : null}
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Settings className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-slate-700">2FA</p>
                <p className="mt-0.5 text-xs text-slate-500">Bientôt disponible</p>
              </div>
            </div>
          </div>
        </div>

        {passwordMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            {passwordMessage}
          </div>
        ) : null}

        {passwordError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
            {passwordError}
          </div>
        ) : null}

        <div className="mt-6">
          <label htmlFor="password" className={labelBase}>
            Nouveau mot de passe
          </label>
          <div className="relative" suppressHydrationWarning>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputBase}
              placeholder="8 caractères minimum"
            />
            <button
              type="button"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-2xl border border-transparent text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">8 caractères minimum</p>
            <p
              className={
                "text-xs font-semibold " +
                (passwordStrength.tone === "emerald"
                  ? "text-emerald-700"
                  : passwordStrength.tone === "amber"
                    ? "text-amber-700"
                    : "text-rose-700")
              }
            >
              {passwordStrength.label}
            </p>
          </div>

          <label htmlFor="passwordConfirm" className={`mt-4 ${labelBase}`}>
            Confirmer
          </label>
          <div className="relative" suppressHydrationWarning>
            <input
              id="passwordConfirm"
              type={showPasswordConfirm ? "text" : "password"}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={inputBase}
              placeholder="Répète le mot de passe"
            />
            <button
              type="button"
              aria-label={showPasswordConfirm ? "Masquer la confirmation" : "Afficher la confirmation"}
              onClick={() => setShowPasswordConfirm((p) => !p)}
              className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-2xl border border-transparent text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            >
              {showPasswordConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={!passwordCanSubmit}
              onClick={async () => {
                setPasswordError(null);
                setPasswordMessage(null);

                if (password.length < 8) {
                  setPasswordError("Mot de passe trop court (8 caractères minimum).");
                  return;
                }
                if (password !== passwordConfirm) {
                  setPasswordError("Les mots de passe ne correspondent pas.");
                  return;
                }

                setPasswordSubmitting(true);
                try {
                  const res = await fetch("/api/auth/set-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password, passwordConfirm }),
                  });
                  const payload = (await res.json()) as { ok?: boolean; error?: string };
                  if (!res.ok || !payload.ok) {
                    if (payload.error === "UNAUTHORIZED") {
                      setPasswordError("Tu dois être connecté pour faire ça.");
                      return;
                    }
                    setPasswordError("Impossible de définir le mot de passe. Réessaie.");
                    return;
                  }

                  setPasswordMessage("Mot de passe défini. Tu peux maintenant te connecter avec email + mot de passe.");
                  setPassword("");
                  setPasswordConfirm("");
                  setSecurity((prev) => (prev ? { ...prev, passwordSet: true } : prev));
                } catch {
                  setPasswordError("Impossible de définir le mot de passe. Réessaie.");
                } finally {
                  setPasswordSubmitting(false);
                }
              }}
              className="inline-flex w-auto max-w-[320px] items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Définir mon mot de passe
            </button>
          </div>
        </div>
      </div>

      <div className={cardBase}>
        <div className={sectionTitle}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
            <p className="mt-2 text-sm text-slate-600">Notifications par email uniquement (pour l’instant).</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {(
            [
              ["newMessages", "Nouveaux messages", "messages"],
              ["messageReceived", "Emails de messages", "messages"],
              ["newBookingRequest", "Nouvelle demande de réservation", "booking"],
              ["bookingConfirmed", "Réservation confirmée", "booking"],
              ["paymentReceived", "Paiement reçu", "payment"],
              ["bookingReminder", "Rappel avant réservation", "reminder"],
            ] as const
          ).map(([key, label, iconKey]) => {
            const checked = Boolean(settingsState.notifications[key]);
            const disabled = meLoading || prefsSubmitting || profileSubmitting || passwordSubmitting || notificationSavingKey === key;

            const Icon =
              iconKey === "messages"
                ? MessageCircle
                : iconKey === "payment"
                  ? CreditCard
                  : iconKey === "reminder"
                    ? Bell
                    : CalendarDays;

            return (
              <button
                key={key}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => void saveNotificationPreference(key, !checked)}
                className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{label}</span>
                  </span>
                </span>

                <span className="flex flex-none items-center gap-3">
                  {notificationSavedKey === key ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : null}

                  <span
                    aria-hidden="true"
                    className={
                      "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors duration-200 " +
                      (checked
                        ? "border-[color-mix(in_srgb,var(--dogshift-blue),black_5%)] bg-[var(--dogshift-blue)]"
                        : "border-slate-200 bg-slate-100")
                    }
                  >
                    <span
                      className={
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 " +
                        (checked ? "translate-x-5" : "translate-x-1")
                      }
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cardBase}>
        <div className={sectionTitle}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Préférences</h2>
            <p className="mt-2 text-sm text-slate-600">Personnalise la langue et le format d’affichage.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelBase} htmlFor="language">
              Langue
            </label>
            <select
              id="language"
              value={settingsState.preferences.language}
              onChange={(e) =>
                setSettingsState((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, language: e.target.value as any },
                }))
              }
              className={inputBase}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="it">Italiano</option>
            </select>
          </div>

          <div>
            <label className={labelBase} htmlFor="timezone">
              Fuseau horaire
            </label>
            <input
              id="timezone"
              value={settingsState.preferences.timeZone}
              onChange={(e) => setSettingsState((prev) => ({ ...prev, preferences: { ...prev.preferences, timeZone: e.target.value } }))}
              className={inputBase}
              placeholder="Europe/Zurich"
            />
            <p className="mt-2 text-xs text-slate-500">Détecté automatiquement par défaut.</p>
          </div>

          <div className="sm:col-span-2">
            <label className={labelBase} htmlFor="dateFormat">
              Format de date
            </label>
            <select
              id="dateFormat"
              value={settingsState.preferences.dateFormat}
              onChange={(e) =>
                setSettingsState((prev) => ({
                  ...prev,
                  preferences: { ...prev.preferences, dateFormat: e.target.value as any },
                }))
              }
              className={inputBase}
            >
              <option value="auto">Auto</option>
              <option value="dd/mm/yyyy">JJ/MM/AAAA</option>
              <option value="mm/dd/yyyy">MM/JJ/AAAA</option>
              <option value="yyyy-mm-dd">AAAA-MM-JJ</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={prefsSubmitting || meLoading}
            onClick={async () => {
              setPrefsSubmitting(true);
              setMeError(null);
              try {
                const res = await fetch("/api/account/settings/me", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ settings: settingsState }),
                });
                const payload = (await res.json()) as { ok?: boolean };
                if (!res.ok || !payload.ok) {
                  setMeError("Impossible d’enregistrer les préférences.");
                  return;
                }
                setToast("Préférences enregistrées");
              } catch {
                setMeError("Impossible d’enregistrer les préférences.");
              } finally {
                setPrefsSubmitting(false);
              }
            }}
            className="inline-flex w-auto max-w-[320px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Enregistrer mes préférences
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
        <div className={sectionTitle}>
          <div className="mx-auto text-center">
            <h2 className="text-lg font-semibold text-slate-900">Sécurité du compte</h2>
            <p className="mt-2 text-sm text-slate-600">Gère les connexions et les actions importantes liées à ton compte.</p>
          </div>
          <Shield className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setToast("Cette action arrive bientôt.");
            }}
            className="inline-flex w-auto max-w-[320px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Se déconnecter de tous les appareils
          </button>
          <p className="-mt-1 max-w-[320px] text-center text-xs text-slate-500">Déconnecte ton compte de tous les appareils actuellement connectés.</p>

          <button
            type="button"
            disabled
            className="inline-flex w-auto max-w-[320px] items-center justify-center rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-900/70 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            Supprimer mon compte (bientôt)
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
