"use client";

import { useState } from "react";

type VerificationStatus = "not_verified" | "pending" | "approved" | "rejected";
type ActionType = "approve" | "reject" | "suspend" | "reactivate" | "publish" | "unpublish";

type Props = {
  sitterUserId: string;
  initialPublished: boolean;
  initialVerificationStatus: VerificationStatus;
  initialVerificationNotes: string | null;
  compact?: boolean;
};

const ACTIONS: Array<{ action: ActionType; label: string; tone: string }> = [
  { action: "approve", label: "Valider", tone: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { action: "reject", label: "Refuser", tone: "bg-rose-600 hover:bg-rose-700 text-white" },
  { action: "suspend", label: "Suspendre", tone: "bg-slate-900 hover:bg-slate-800 text-white" },
  { action: "reactivate", label: "Réactiver", tone: "bg-sky-600 hover:bg-sky-700 text-white" },
  { action: "publish", label: "Publier", tone: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-900" },
  { action: "unpublish", label: "Dépublier", tone: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-900" },
];

function verificationLabel(status: VerificationStatus) {
  if (status === "approved") return "approuvé";
  if (status === "pending") return "en attente";
  if (status === "rejected") return "refusé";
  return "non vérifié";
}

function actionAllowed(action: ActionType, published: boolean, verificationStatus: VerificationStatus) {
  if (action === "approve") return verificationStatus === "pending" || verificationStatus === "rejected" || verificationStatus === "not_verified";
  if (action === "reject") return verificationStatus === "pending" || verificationStatus === "approved";
  if (action === "suspend") return published && verificationStatus === "approved";
  if (action === "reactivate") return !published && verificationStatus === "approved";
  if (action === "publish") return !published && verificationStatus === "approved";
  if (action === "unpublish") return published;
  return true;
}

function actionHelp(action: ActionType, published: boolean, verificationStatus: VerificationStatus) {
  if (actionAllowed(action, published, verificationStatus)) return null;
  if ((action === "publish" || action === "reactivate") && verificationStatus !== "approved") {
    return "Réservé aux profils approuvés.";
  }
  if (action === "suspend" && !published) {
    return "Profil déjà non publié.";
  }
  if (action === "unpublish" && !published) {
    return "Profil déjà non publié.";
  }
  if (action === "approve" && verificationStatus === "approved") {
    return "Profil déjà approuvé.";
  }
  if (action === "reject" && verificationStatus === "rejected") {
    return "Profil déjà refusé.";
  }
  return "Action non cohérente dans cet état.";
}

export default function AdminSitterActions({
  sitterUserId,
  initialPublished,
  initialVerificationStatus,
  initialVerificationNotes,
  compact = false,
}: Props) {
  const [published, setPublished] = useState(initialPublished);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(initialVerificationStatus);
  const [notes, setNotes] = useState(initialVerificationNotes ?? "");
  const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function runAction(action: ActionType) {
    if (loadingAction) return;
    setLoadingAction(action);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/sitters/${sitterUserId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, notes }),
      });
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !payload?.profile) {
        setError("Impossible d’exécuter l’action admin.");
        return;
      }

      setPublished(Boolean(payload.profile.published));
      setVerificationStatus(payload.profile.verificationStatus as VerificationStatus);
      setNotes(typeof payload.profile.verificationNotes === "string" ? payload.profile.verificationNotes : "");
      setSuccess("Action enregistrée.");
    } catch {
      setError("Impossible d’exécuter l’action admin.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className={`rounded-3xl border border-slate-200 bg-white ${compact ? "p-4" : "p-6 sm:p-8"} shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">Actions rapides</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Validation, refus, suspension et publication sans quitter le panel.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Statut: {verificationLabel(verificationStatus)}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Profil: {published ? "publié" : "non publié"}</span>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {verificationStatus === "approved"
            ? published
              ? "Profil approuvé et publié: vous pouvez le suspendre ou le dépublier si nécessaire."
              : "Profil approuvé mais non publié: publication ou réactivation disponibles."
            : verificationStatus === "pending"
              ? "Profil en attente de revue: validation ou refus disponibles."
              : verificationStatus === "rejected"
                ? "Profil refusé: vous pouvez le revalider si la situation a été corrigée."
                : "Profil non vérifié: validation possible, mais publication bloquée tant que le profil n’est pas approuvé."}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-700" htmlFor={`sitter_admin_notes_${sitterUserId}`}>
            Notes admin liées à l’action
          </label>
          <textarea
            id={`sitter_admin_notes_${sitterUserId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
            placeholder="Motif, décision, contexte opérationnel…"
          />
        </div>
      ) : null}

      <div className={`mt-5 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {ACTIONS.map((item) => {
          const allowed = actionAllowed(item.action, published, verificationStatus);
          const help = actionHelp(item.action, published, verificationStatus);
          return (
            <div key={item.action} className="grid gap-1">
              <button
                type="button"
                disabled={!allowed || loadingAction !== null}
                onClick={() => void runAction(item.action)}
                className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${item.tone}`}
              >
                {loadingAction === item.action ? "En cours…" : item.label}
              </button>
              {!compact && help ? <p className="px-1 text-xs text-slate-500">{help}</p> : null}
            </div>
          );
        })}
      </div>

      {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}
      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
    </section>
  );
}
