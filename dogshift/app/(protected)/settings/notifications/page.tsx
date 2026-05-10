"use client";

import { Bell, BellOff, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { usePushNotifications } from "@/components/PushPermissionPrompt";

export default function NotificationSettingsPage() {
  const { isSupported, permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-xl font-bold text-slate-900">Notifications push</h1>
      <p className="mb-8 text-sm text-slate-500">
        Recevez des alertes instantanées sur cet appareil, même quand DogShift est fermé.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Status
          isSupported={isSupported}
          permission={permission}
          isSubscribed={isSubscribed}
          onSubscribe={subscribe}
          onUnsubscribe={unsubscribe}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Types de notifications
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {[
            "Nouvelle demande de réservation reçue",
            "Réservation confirmée par un sitter",
            "Nouveau message",
          ].map((label) => (
            <li key={label} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          La gestion individuelle par type sera disponible dans une prochaine mise à jour.
        </p>
      </div>
    </div>
  );
}

function Status({
  isSupported,
  permission,
  isSubscribed,
  onSubscribe,
  onUnsubscribe,
}: {
  isSupported: boolean;
  permission: string;
  isSubscribed: boolean;
  onSubscribe: () => Promise<boolean>;
  onUnsubscribe: () => Promise<void>;
}) {
  if (!isSupported) {
    return (
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Non supporté sur cet appareil</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Les notifications push nécessitent un navigateur compatible (Chrome, Firefox, Safari 16.4+
            avec la PWA installée sur l&apos;écran d&apos;accueil).
          </p>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div>
          <p className="text-sm font-semibold text-slate-700">Notifications bloquées</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tu as refusé les notifications. Pour les activer, ouvre les réglages de ton navigateur,
            cherche DogShift et autorise les notifications.
          </p>
        </div>
      </div>
    );
  }

  if (isSubscribed) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
            <Bell className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Notifications activées</p>
            <p className="text-xs text-slate-500">Cet appareil reçoit les alertes DogShift.</p>
          </div>
        </div>
        <button
          onClick={onUnsubscribe}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <BellOff className="h-3.5 w-3.5" />
          Désactiver
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
          <BellOff className="h-4 w-4 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Notifications désactivées</p>
          <p className="text-xs text-slate-500">Activez-les pour ne rien rater.</p>
        </div>
      </div>
      <button
        onClick={onSubscribe}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        style={{ backgroundColor: "var(--dogshift-blue)" }}
      >
        Activer
      </button>
    </div>
  );
}
