"use client";

import { useState } from "react";

import { canGenerateContractAccessLink, lifecycleStatusLabel, type SitterLifecycleStatus } from "@/lib/sitterContract";

type VerificationStatus = "not_verified" | "pending" | "approved" | "rejected";
type ActionType = "select" | "generate_contract_link" | "approve" | "reject" | "suspend" | "reactivate" | "publish" | "unpublish" | "activate" | "send_activation_code" | "save_notes";

type Props = {
  sitterUserId: string;
  initialPublished: boolean;
  initialVerificationStatus: VerificationStatus;
  initialVerificationNotes: string | null;
  initialLifecycleStatus?: SitterLifecycleStatus;
  initialContractAccessTokenIssuedAt?: string | null;
  initialContractAccessTokenExpiresAt?: string | null;
  compact?: boolean;
};

const ACTIONS: Array<{ action: ActionType; label: string; tone: string }> = [
  { action: "select", label: "Sélectionner", tone: "bg-indigo-600 hover:bg-indigo-700 text-white" },
  { action: "generate_contract_link", label: "Envoyer le contrat", tone: "bg-violet-600 hover:bg-violet-700 text-white" },
  { action: "send_activation_code", label: "Envoyer code d'activation", tone: "bg-amber-500 hover:bg-amber-600 text-white" },
  { action: "activate", label: "Activer le compte", tone: "bg-emerald-700 hover:bg-emerald-800 text-white" },
  { action: "approve", label: "Valider vérif.", tone: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { action: "reject", label: "Refuser vérif.", tone: "bg-rose-600 hover:bg-rose-700 text-white" },
  { action: "suspend", label: "Suspendre", tone: "bg-slate-900 hover:bg-slate-800 text-white" },
  { action: "reactivate", label: "Réactiver", tone: "bg-sky-600 hover:bg-sky-700 text-white" },
  { action: "publish", label: "Publier", tone: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-900" },
  { action: "unpublish", label: "Dépublier", tone: "border border-slate-300 bg-white hover:bg-slate-50 text-slate-900" },
];

const COMPACT_ACTION_GROUPS: Array<Array<ActionType>> = [
  ["select"],
  ["generate_contract_link"],
  ["send_activation_code"],
  ["activate"],
  ["approve", "reject"],
  ["suspend", "reactivate"],
  ["publish", "unpublish"],
];

function verificationLabel(status: VerificationStatus) {
  if (status === "approved") return "approuvé";
  if (status === "pending") return "en attente";
  if (status === "rejected") return "refusé";
  return "non vérifié";
}

function actionAllowed(action: ActionType, published: boolean, verificationStatus: VerificationStatus, lifecycleStatus: SitterLifecycleStatus) {
  if (action === "select") return lifecycleStatus === "application_received";
  if (action === "generate_contract_link") return canGenerateContractAccessLink(lifecycleStatus);
  if (action === "activate") return lifecycleStatus === "contract_signed" && !published;
  if (action === "send_activation_code") return lifecycleStatus === "contract_signed" || lifecycleStatus === "activated";
  if (action === "approve") return verificationStatus === "pending" || verificationStatus === "rejected" || verificationStatus === "not_verified";
  if (action === "reject") return verificationStatus === "pending" || verificationStatus === "approved";
  if (action === "suspend") return published && verificationStatus === "approved";
  if (action === "reactivate") return !published && verificationStatus === "approved" && lifecycleStatus === "activated";
  if (action === "publish") return !published && verificationStatus === "approved" && lifecycleStatus === "activated";
  if (action === "unpublish") return published;
  return true;
}

function actionHelp(action: ActionType, published: boolean, verificationStatus: VerificationStatus, lifecycleStatus: SitterLifecycleStatus) {
  if (actionAllowed(action, published, verificationStatus, lifecycleStatus)) return null;
  if (action === "activate" && lifecycleStatus !== "contract_signed") {
    return lifecycleStatus === "activated" ? "Compte déjà activé." : "Requiert que le contrat soit signé.";
  }
  if (action === "send_activation_code" && lifecycleStatus !== "contract_signed" && lifecycleStatus !== "activated") {
    return "Disponible uniquement après signature du contrat.";
  }
  if ((action === "publish" || action === "reactivate") && verificationStatus !== "approved") {
    return "Réservé aux profils approuvés.";
  }
  if ((action === "publish" || action === "reactivate") && lifecycleStatus !== "activated") {
    return "Activez d'abord le compte (bouton « Activer le compte »).";
  }
  if (action === "generate_contract_link" && !canGenerateContractAccessLink(lifecycleStatus)) {
    return "Le lien sécurisé ne peut pas être émis tant que la candidature n’est pas sélectionnée.";
  }
  if (action === "select" && lifecycleStatus !== "application_received") {
    return "La sélection est déjà effectuée ou dépassée.";
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
  initialLifecycleStatus = "application_received",
  initialContractAccessTokenIssuedAt = null,
  initialContractAccessTokenExpiresAt = null,
  compact = false,
}: Props) {
  const [published, setPublished] = useState(initialPublished);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(initialVerificationStatus);
  const [lifecycleStatus, setLifecycleStatus] = useState<SitterLifecycleStatus>(initialLifecycleStatus);
  const [notes, setNotes] = useState(initialVerificationNotes ?? "");
  const [contractAccessTokenIssuedAt, setContractAccessTokenIssuedAt] = useState<string | null>(initialContractAccessTokenIssuedAt);
  const [contractAccessTokenExpiresAt, setContractAccessTokenExpiresAt] = useState<string | null>(initialContractAccessTokenExpiresAt);
  const [latestContractAccessLink, setLatestContractAccessLink] = useState<string | null>(null);
  const [latestContractAccessFingerprint, setLatestContractAccessFingerprint] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function runAction(action: ActionType, notesOverride?: string) {
    if (loadingAction) return;
    setLoadingAction(action);
    setError(null);
    setSuccess(null);

    const notesPayload = notesOverride !== undefined ? notesOverride : notes;

    try {
      const res = await fetch(`/api/admin/sitters/${sitterUserId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, notes: notesPayload }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape; narrowed by runtime checks below.
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !payload?.profile) {
        setError("Impossible d’exécuter l’action admin.");
        return;
      }

      setPublished(Boolean(payload.profile.published));
      setVerificationStatus(payload.profile.verificationStatus as VerificationStatus);
      setNotes(typeof payload.profile.verificationNotes === "string" ? payload.profile.verificationNotes : "");
      setLifecycleStatus((payload.profile.lifecycleStatus as SitterLifecycleStatus) ?? lifecycleStatus);
      setContractAccessTokenIssuedAt(typeof payload.profile.contractAccessTokenIssuedAt === "string" ? payload.profile.contractAccessTokenIssuedAt : null);
      setContractAccessTokenExpiresAt(typeof payload.profile.contractAccessTokenExpiresAt === "string" ? payload.profile.contractAccessTokenExpiresAt : null);
      setLatestContractAccessLink(typeof payload.contractAccessLink === "string" ? payload.contractAccessLink : null);
      setLatestContractAccessFingerprint(typeof payload.contractAccessTokenFingerprint === "string" ? payload.contractAccessTokenFingerprint : null);
      setSuccess(
        action === "send_activation_code"
          ? "Code d'activation envoyé par email."
          : action === "save_notes"
            ? notesPayload.trim()
              ? "Notes enregistrées."
              : "Notes supprimées."
            : "Action enregistrée.",
      );
    } catch {
      setError("Impossible d’exécuter l’action admin.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className={`rounded-3xl border border-slate-200 bg-white ${compact ? "w-[220px] min-w-[220px] p-3" : "p-6 sm:p-8"} shadow-[0_18px_60px_-46px_rgba(2,6,23,0.12)]`}>
      <div className={`flex ${compact ? "flex-col gap-2" : "flex-wrap items-start justify-between gap-3"}`}>
        <div>
          <h3 className={`${compact ? "text-sm" : "text-lg"} font-semibold tracking-tight text-slate-900`}>Actions rapides</h3>
          {!compact ? <p className="mt-2 text-sm leading-relaxed text-slate-600">Validation, refus, suspension et publication sans quitter le panel.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{verificationLabel(verificationStatus)}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{published ? "publié" : "non publié"}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{lifecycleStatusLabel(lifecycleStatus)}</span>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {verificationStatus === "approved"
            ? published
              ? "Profil approuvé et publié: vous pouvez le suspendre ou le dépublier si nécessaire."
              : lifecycleStatus === "activated"
                ? "Profil approuvé et activé: publication ou réactivation disponibles."
                : lifecycleStatus === "contract_signed"
                  ? "Contrat signé ✓ — cliquez sur « Activer le compte » pour permettre à la dogsitter de publier son profil."
                  : "Profil approuvé mais non activé : envoyez le contrat sécurisé puis activez le compte une fois signé." 
            : verificationStatus === "pending"
              ? "Profil en attente de revue: validation ou refus disponibles."
              : verificationStatus === "rejected"
                ? "Profil refusé: vous pouvez le revalider si la situation a été corrigée."
                : lifecycleStatus === "application_received"
                  ? "Candidature reçue: sélectionnez le dogsitter pour ouvrir la signature du contrat."
                  : lifecycleStatus === "contract_to_sign"
                    ? "Contrat envoyé: la candidate doit signer via son lien sécurisé personnel."
                  : "Profil non vérifié: validation possible, mais publication bloquée tant que le profil n’est pas approuvé."}
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Lien sécurisé de signature</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Usage unique, personnel, invalide après signature ou expiration.</p>
            </div>
            <button
              type="button"
              disabled={!actionAllowed("generate_contract_link", published, verificationStatus, lifecycleStatus) || loadingAction !== null}
              onClick={() => void runAction("generate_contract_link")}
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingAction === "generate_contract_link" ? "En cours…" : contractAccessTokenIssuedAt ? "Renvoyer le contrat" : "Envoyer le contrat"}
            </button>
          </div>
          {!contractAccessTokenIssuedAt ? <p className="mt-3 text-xs text-slate-500">Statut contrat : non envoyé.</p> : null}
          {contractAccessTokenIssuedAt && lifecycleStatus !== "contract_signed" ? <p className="mt-3 text-xs text-slate-500">Statut contrat : envoyé le {contractAccessTokenIssuedAt}.</p> : null}
          {lifecycleStatus === "contract_signed" ? <p className="mt-3 text-xs text-emerald-700">Statut contrat : signé.</p> : null}
          {contractAccessTokenExpiresAt ? <p className="mt-1 text-xs text-slate-500">Expiration prévue le {contractAccessTokenExpiresAt}.</p> : null}
          {latestContractAccessFingerprint ? <p className="mt-1 text-xs text-slate-500">Empreinte du lien courant: {latestContractAccessFingerprint}</p> : null}
          {latestContractAccessLink ? (
            <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-700">Dernier lien généré</p>
              <p className="mt-2 break-all text-xs text-slate-600">{latestContractAccessLink}</p>
            </div>
          ) : null}
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
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={() => void runAction("save_notes")}
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "save_notes" ? "Enregistrement…" : "Enregistrer les notes"}
            </button>
            <button
              type="button"
              disabled={loadingAction !== null || notes.trim().length === 0}
              onClick={() => {
                setNotes("");
                void runAction("save_notes", "");
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Supprimer les notes
            </button>
          </div>
        </div>
      ) : null}

      {compact ? (
        <div className="mt-4 grid gap-2">
          {COMPACT_ACTION_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className="grid gap-2">
              {group.map((actionName) => {
                const item = ACTIONS.find((entry) => entry.action === actionName);
                if (!item) return null;
                const allowed = actionAllowed(item.action, published, verificationStatus, lifecycleStatus);
                return (
                  <button
                    key={item.action}
                    type="button"
                    disabled={!allowed || loadingAction !== null}
                    onClick={() => void runAction(item.action)}
                    className={`inline-flex h-9 w-full items-center justify-center rounded-xl px-3 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${item.tone}`}
                  >
                    {loadingAction === item.action ? "En cours…" : item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACTIONS.map((item) => {
            const allowed = actionAllowed(item.action, published, verificationStatus, lifecycleStatus);
            const help = actionHelp(item.action, published, verificationStatus, lifecycleStatus);
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
                {help ? <p className="px-1 text-xs text-slate-500">{help}</p> : null}
              </div>
            );
          })}
        </div>
      )}

      {success ? <p className={`mt-4 font-medium text-emerald-700 ${compact ? "text-xs" : "text-sm"}`}>{success}</p> : null}
      {error ? <p className={`mt-4 font-medium text-rose-600 ${compact ? "text-xs" : "text-sm"}`}>{error}</p> : null}
    </section>
  );
}
