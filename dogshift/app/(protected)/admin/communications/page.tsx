"use client";

import { useState } from "react";
import { Mail, Eye, Send, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";

type SendResult = {
  total: number;
  sent: number;
  failed: number;
  errors: string[];
};

export default function CommunicationsPage() {
  const [customMessage, setCustomMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoadingPreview(true);
    setPreviewHtml(null);
    try {
      const res = await fetch("/api/admin/notify-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customMessage, preview: true }),
      });
      const data = await res.json();
      if (data?.html) setPreviewHtml(data.html);
    } catch {
      setPreviewHtml(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function sendEmails() {
    setSending(true);
    setShowConfirm(false);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/notify-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customMessage }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error ?? "Erreur lors de l'envoi.");
      } else {
        setResult(data as SendResult);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminShell>
      <div className="space-y-8 px-2 pt-6 sm:px-4">

        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Communications</h2>
          <p className="mt-2 text-sm text-slate-500">
            Envoyez un email à tous les utilisateurs de la plateforme (ex : mise à jour des CGU).
          </p>
        </div>

        {/* Résultat envoi */}
        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="font-semibold text-emerald-900">Envoi terminé</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-slate-900">{result.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-emerald-600">{result.sent}</p>
                <p className="text-xs text-slate-500">Envoyés</p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-rose-600">{result.failed}</p>
                <p className="text-xs text-slate-500">Échecs</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 rounded-xl bg-white p-3">
                <p className="text-xs font-semibold text-rose-700">Erreurs :</p>
                <ul className="mt-1 space-y-0.5">
                  {result.errors.map((e) => (
                    <li key={e} className="text-xs text-rose-600">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Formulaire */}
          <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-[#2f4d6b]" />
              <h3 className="font-semibold text-slate-900">Composer l'email</h3>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Objet (fixe)</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Mise à jour de nos Conditions Générales d'Utilisation — DogShift
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Message personnalisé <span className="font-normal normal-case text-slate-400">(optionnel)</span>
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={5}
                placeholder="Ex : Nous avons clarifié notre politique d'annulation et mis à jour la section sur la conservation des données…"
                className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-[#2f4d6b] focus:ring-2 focus:ring-[#2f4d6b]/20"
              />
              <p className="mt-1 text-xs text-slate-400">
                Ce texte apparaît dans un encadré bleu au milieu de l'email. Laissez vide pour un email générique.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={loadPreview}
                disabled={loadingPreview}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <Eye className="h-4 w-4" />
                {loadingPreview ? "Chargement…" : "Prévisualiser"}
              </button>

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={sending}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2f4d6b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sending ? "Envoi en cours…" : "Envoyer à tous"}
              </button>
            </div>

            {sending && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                Envoi en cours — ne fermez pas cette page. Cela peut prendre quelques minutes selon le nombre d'utilisateurs.
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
              <Eye className="h-4 w-4 text-slate-400" />
              <h3 className="font-semibold text-slate-900">Prévisualisation</h3>
            </div>
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="h-[520px] w-full"
                title="Prévisualisation de l'email"
                sandbox="allow-same-origin"
              />
            ) : (
              <div className="flex h-[520px] flex-col items-center justify-center gap-3 text-slate-400">
                <Mail className="h-10 w-10 opacity-30" />
                <p className="text-sm">Cliquez sur "Prévisualiser" pour voir le rendu</p>
              </div>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">À propos de cet envoi</p>
              <p className="text-blue-700">L'email sera envoyé à <strong>tous les utilisateurs</strong> ayant un compte sur DogShift (propriétaires et dogsitters). L'envoi est cadencé pour respecter les limites Resend. Après l'envoi, les utilisateurs verront également le bandeau de re-acceptation des CGU la prochaine fois qu'ils visitent le site.</p>
              <p className="mt-2 text-blue-700">Pour déclencher le bandeau CGU sur le site, pensez à mettre à jour <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-xs">CGU_VERSION</code> dans <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-xs">lib/cguVersion.ts</code>.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Modal de confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Send className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Confirmer l'envoi</h3>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Vous allez envoyer un email de mise à jour des CGU à <strong>tous les utilisateurs</strong> de DogShift. Cette action est irréversible.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={sendEmails}
                className="flex-1 rounded-2xl bg-[#2f4d6b] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
