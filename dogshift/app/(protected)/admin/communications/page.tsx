"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mail,
  Eye,
  Send,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  Dog,
  UserCheck,
  AtSign,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";

// ─── Types ────────────────────────────────────────────────────────────────────

type Target = "all" | "sitters" | "owners" | "custom";

interface HistoryEntry {
  id: string;
  createdAt: string;
  actorId: string | null;
  metadata: {
    subject?: string;
    target?: string;
    total?: number;
    sent?: number;
    failed?: number;
  } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_OPTIONS: { value: Target; label: string; Icon: React.ElementType; desc: string }[] = [
  { value: "all", label: "Tout le monde", Icon: Users, desc: "Tous les utilisateurs inscrits" },
  { value: "sitters", label: "Dogsitters", Icon: Dog, desc: "Dogsitters uniquement" },
  { value: "owners", label: "Propriétaires", Icon: UserCheck, desc: "Propriétaires de chiens uniquement" },
  { value: "custom", label: "Emails spécifiques", Icon: AtSign, desc: "Entrez manuellement les adresses" },
];

const DEFAULT_SUBJECT = "Mise à jour de nos Conditions Générales d'Utilisation";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function targetLabel(t?: string) {
  return TARGET_OPTIONS.find((o) => o.value === t)?.label ?? t ?? "—";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommunicationsPage() {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [target, setTarget] = useState<Target>("all");
  const [customEmails, setCustomEmails] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    total?: number;
    sent?: number;
    failed?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ─── Load history ──────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/notify-users");
      const data = await res.json();
      if (data.ok) setHistory(data.logs ?? []);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // ─── Preview ───────────────────────────────────────────────────────────────

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewHtml(null);
    try {
      const res = await fetch("/api/admin/notify-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || DEFAULT_SUBJECT,
          customMessage: customMessage.trim(),
          target,
          customEmails: parseCustomEmails(),
          preview: true,
        }),
      });
      const data = await res.json();
      if (data.ok && data.html) {
        setPreviewHtml(data.html);
      }
    } catch {
      // silent
    } finally {
      setPreviewLoading(false);
    }
  }

  // ─── Send ──────────────────────────────────────────────────────────────────

  function parseCustomEmails(): string[] {
    return customEmails
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
  }

  async function handleSend() {
    setShowConfirm(false);
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/notify-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim() || DEFAULT_SUBJECT,
          customMessage: customMessage.trim(),
          target,
          customEmails: parseCustomEmails(),
          preview: false,
        }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        await loadHistory();
      }
    } catch {
      setResult({ ok: false, error: "Erreur réseau" });
    } finally {
      setSending(false);
    }
  }

  // ─── Sync preview iframe ───────────────────────────────────────────────────

  useEffect(() => {
    if (iframeRef.current && previewHtml !== null) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  const canSend = subject.trim().length >= 3 && !sending;
  const customEmailList = parseCustomEmails();
  const customEmailsValid = target !== "custom" || customEmailList.length > 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <AdminShell>
      <div className="space-y-8 px-2 pt-6 sm:px-4">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Communications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Envoyez un e-mail groupé aux utilisateurs DogShift.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#2f4d6b]" />
              <span className="font-semibold text-slate-800">Nouveau message</span>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6">

            {/* Sujet */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Sujet de l'e-mail
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex : Mise à jour de nos CGU"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-[#2f4d6b] focus:bg-white focus:ring-2 focus:ring-[#2f4d6b]/20"
              />
            </div>

            {/* Destinataires */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Destinataires
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TARGET_OPTIONS.map(({ value, label, Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTarget(value)}
                    className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
                      target === value
                        ? "border-[#2f4d6b] bg-[#2f4d6b]/5 ring-2 ring-[#2f4d6b]/20"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${target === value ? "text-[#2f4d6b]" : "text-slate-400"}`}
                    />
                    <span
                      className={`text-xs font-semibold ${target === value ? "text-[#2f4d6b]" : "text-slate-700"}`}
                    >
                      {label}
                    </span>
                    <span className="text-[10px] leading-tight text-slate-400">{desc}</span>
                  </button>
                ))}
              </div>

              {/* Custom email textarea */}
              {target === "custom" && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Adresses e-mail (séparées par virgule, point-virgule ou saut de ligne)
                  </label>
                  <textarea
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    rows={3}
                    placeholder="alice@example.com, bob@example.com"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2f4d6b] focus:bg-white focus:ring-2 focus:ring-[#2f4d6b]/20"
                  />
                  {customEmails.trim() && (
                    <p className="mt-1 text-xs text-slate-400">
                      {customEmailList.length} adresse{customEmailList.length > 1 ? "s" : ""} détectée
                      {customEmailList.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Message personnalisé */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Message personnalisé{" "}
                <span className="font-normal text-slate-400">(optionnel)</span>
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                placeholder="Ex : Nous avons clarifié les conditions relatives aux annulations..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2f4d6b] focus:bg-white focus:ring-2 focus:ring-[#2f4d6b]/20"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading || !subject.trim()}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                {previewLoading ? "Chargement…" : "Prévisualiser"}
              </button>

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={!canSend || !customEmailsValid}
                className="flex items-center gap-2 rounded-xl bg-[#2f4d6b] px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#263f58] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Envoi en cours…" : "Envoyer"}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div
                className={`flex items-start gap-3 rounded-xl p-4 text-sm ${
                  result.ok
                    ? "border border-emerald-100 bg-emerald-50 text-emerald-800"
                    : "border border-red-100 bg-red-50 text-red-800"
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  {result.ok ? (
                    <>
                      <p className="font-semibold">Envoi terminé</p>
                      <p className="mt-0.5 text-xs opacity-80">
                        {result.sent} envoyé{(result.sent ?? 0) > 1 ? "s" : ""} ·{" "}
                        {result.failed} échec{(result.failed ?? 0) > 1 ? "s" : ""} sur{" "}
                        {result.total} destinataire{(result.total ?? 0) > 1 ? "s" : ""}
                      </p>
                      {(result.errors?.length ?? 0) > 0 && (
                        <ul className="mt-1 list-inside list-disc text-xs opacity-70">
                          {result.errors!.slice(0, 5).map((e, i) => (
                            <li key={i}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="font-semibold">{result.error ?? "Une erreur est survenue"}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview iframe */}
        {previewHtml !== null && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
              <Eye className="h-4 w-4 text-slate-400" />
              <span className="font-semibold text-slate-800">Aperçu de l'e-mail</span>
              <span className="ml-auto text-xs text-slate-400">
                Rendu tel qu'il apparaîtra dans la boîte mail
              </span>
            </div>
            <div className="overflow-hidden rounded-b-2xl">
              <iframe
                ref={iframeRef}
                title="Aperçu e-mail"
                className="h-[600px] w-full border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* History */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-6 py-4 text-left"
          >
            <Clock className="h-4 w-4 text-slate-400" />
            <span className="font-semibold text-slate-800">Historique des envois</span>
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {history.length}
            </span>
            <span className="ml-auto text-slate-400">
              {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>

          {historyOpen && (
            <div className="border-t border-slate-100">
              {historyLoading ? (
                <div className="px-6 py-8 text-center text-sm text-slate-400">
                  Chargement…
                </div>
              ) : history.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-slate-400">
                  Aucun e-mail envoyé pour l'instant.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map((entry) => {
                    const m = entry.metadata ?? {};
                    return (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {m.subject ?? "—"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Destinataires : {targetLabel(m.target)} ·{" "}
                            <span className="text-emerald-600 font-medium">
                              {m.sent ?? 0} envoyé{(m.sent ?? 0) > 1 ? "s" : ""}
                            </span>
                            {(m.failed ?? 0) > 0 && (
                              <span className="ml-1 text-red-500">
                                · {m.failed} échec{(m.failed ?? 1) > 1 ? "s" : ""}
                              </span>
                            )}
                            {" · "}
                            {m.total ?? 0} total
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-slate-400">{formatDate(entry.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <h2 className="font-bold text-slate-900">Confirmer l'envoi</h2>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Vous êtes sur le point d'envoyer cet e-mail à{" "}
              <strong>
                {target === "custom"
                  ? `${customEmailList.length} adresse${customEmailList.length > 1 ? "s" : ""}`
                  : targetLabel(target).toLowerCase()}
              </strong>
              . Cette action est irréversible.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSend}
                className="flex-1 rounded-xl bg-[#2f4d6b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#263f58]"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
