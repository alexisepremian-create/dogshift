"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  Megaphone,
  SendHorizonal,
  Sparkles,
  Users,
  CalendarDays,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";

// ─── Template catalogue ───────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

interface EmailCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  templates: EmailTemplate[];
}

const CATEGORIES: EmailCategory[] = [
  {
    id: "candidatures",
    label: "Candidatures & Onboarding",
    icon: Users,
    color: "text-[#2f4d6b]",
    templates: [
      {
        id: "pilot-confirmation",
        label: "Candidature reçue",
        description: "Confirmation envoyée juste après qu'un sitter postule",
      },
      {
        id: "application-high",
        label: "Candidature retenue ✅",
        description: "Profil retenu — invitation à réserver un entretien Calendly",
        badge: "HIGH",
        badgeColor: "bg-emerald-100 text-emerald-700",
      },
      {
        id: "application-review",
        label: "Candidature en examen ⏱️",
        description: "Profil intéressant, examen en cours — réponse sous 5 jours",
        badge: "REVIEW",
        badgeColor: "bg-amber-100 text-amber-700",
      },
      {
        id: "application-low",
        label: "Candidature refusée",
        description: "Profil non retenu pour la phase pilote — porte non définitivement fermée",
        badge: "LOW",
        badgeColor: "bg-slate-100 text-slate-500",
      },
      {
        id: "activation-code",
        label: "Code d'activation",
        description: "Envoyé après signature du contrat — contient le code pour activer le profil",
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Lead Magnets",
    icon: Sparkles,
    color: "text-violet-600",
    templates: [
      {
        id: "lead-magnet",
        label: "Guide gratuit — 5 erreurs",
        description: "Email automatique envoyé après capture du lead magnet sur le site",
      },
      {
        id: "nurturing-step1",
        label: "Nurturing J+1 — Rappel guide",
        description: "Séquence nurturing : envoyé 1 jour après la capture, rappel du guide + sitters",
        badge: "J+1",
        badgeColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "nurturing-step2",
        label: "Nurturing J+3 — Preuve sociale",
        description: "Séquence nurturing : envoyé 3 jours après la capture, avis clients + comment ça marche",
        badge: "J+3",
        badgeColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "nurturing-step3",
        label: "Nurturing J+7 — Dernier email",
        description: "Séquence nurturing : envoyé 7 jours après la capture, services + CTA fort",
        badge: "J+7",
        badgeColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "zootherapie",
        label: "Évaluation zoothérapie",
        description: "Rapport bien-être personnalisé généré par l'agent IA zoothérapie",
      },
    ],
  },
  {
    id: "reservations-owner",
    label: "Réservations — Propriétaires",
    icon: CalendarDays,
    color: "text-sky-600",
    templates: [
      {
        id: "booking-confirmed",
        label: "Réservation confirmée",
        description: "Envoyé au propriétaire quand le dog-sitter accepte la demande",
      },
      {
        id: "payment-received",
        label: "Paiement reçu",
        description: "Confirmation de paiement Stripe pour le propriétaire",
      },
      {
        id: "booking-reminder",
        label: "Rappel de réservation",
        description: "Rappel J-1 ou J-2 avant le début de la prestation",
      },
      {
        id: "booking-cancelled",
        label: "Réservation annulée",
        description: "Notification d'annulation côté propriétaire",
      },
      {
        id: "booking-refunded-owner",
        label: "Remboursement effectué",
        description: "Confirmation de remboursement Stripe pour le propriétaire",
      },
      {
        id: "booking-expired",
        label: "Réservation expirée & remboursée",
        description: "Non-acceptation à temps → annulation automatique + remboursement",
      },
      {
        id: "booking-refund-failed",
        label: "Remboursement impossible",
        description: "Échec du remboursement Stripe — nécessite une action manuelle",
      },
    ],
  },
  {
    id: "reservations-sitter",
    label: "Réservations — Dog-sitters",
    icon: CalendarDays,
    color: "text-teal-600",
    templates: [
      {
        id: "booking-request",
        label: "Nouvelle demande reçue",
        description: "Notification au dog-sitter quand un propriétaire fait une demande",
      },
      {
        id: "booking-refunded-host",
        label: "Réservation annulée (vue sitter)",
        description: "Le propriétaire a annulé — remboursement traité",
      },
    ],
  },
  {
    id: "onboarding",
    label: "Onboarding & Relances",
    icon: MessageSquare,
    color: "text-indigo-600",
    templates: [
      {
        id: "welcome-owner",
        label: "Bienvenue propriétaire",
        description: "Envoyé automatiquement à la première connexion d'un nouveau propriétaire",
      },
      {
        id: "review-request",
        label: "Demande d'avis",
        description: "Cron J+1/J+2 après la fin d'une réservation — invite le propriétaire à noter son sitter",
      },
      {
        id: "relance-owner",
        label: "Relance propriétaire ✨ IA",
        description: "Généré par Claude — personnalisé selon le propriétaire et le sitter avec qui il a échangé sans réserver",
        badge: "IA",
        badgeColor: "bg-violet-100 text-violet-700",
      },
      {
        id: "new-message",
        label: "Nouveau message",
        description: "Notification email quand un participant à une conversation reçoit un message",
      },
    ],
  },
  {
    id: "communications",
    label: "Communications Admin",
    icon: Megaphone,
    color: "text-rose-600",
    templates: [
      {
        id: "communications",
        label: "Email groupé",
        description: "Template utilisé pour les envois massifs depuis /admin/communications",
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminEmailsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, true])),
  );
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  async function loadPreview(templateId: string) {
    if (loading) return;
    setSelected(templateId);
    setLoading(true);
    setPreviewHtml(null);
    setPreviewSubject("");
    setTestState("idle");
    try {
      const res = await fetch(`/api/admin/email-preview?template=${encodeURIComponent(templateId)}`);
      const data = await res.json();
      if (data.ok && data.html) {
        setPreviewHtml(data.html);
        setPreviewSubject(data.subject ?? "");
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

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

  async function sendTestEmail() {
    if (!selected || testState === "sending") return;
    setTestState("sending");
    try {
      const res = await fetch("/api/admin/email-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selected }),
      });
      const data = await res.json();
      setTestState(data.ok ? "sent" : "error");
    } catch {
      setTestState("error");
    }
    setTimeout(() => setTestState("idle"), 3000);
  }

  function toggleCategory(id: string) {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const totalTemplates = CATEGORIES.reduce((acc, c) => acc + c.templates.length, 0);

  return (
    <AdminShell>
      <div className="flex h-full flex-col gap-0">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#2f4d6b]" />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Aperçu des emails
            </h1>
            <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
              {totalTemplates} templates
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Visualisez tous les emails automatiques envoyés par DogShift avec des données de démonstration.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex min-h-0 flex-1 gap-4 lg:gap-6" style={{ minHeight: "calc(100vh - 220px)" }}>

          {/* Left — Template list */}
          <div className="w-full shrink-0 space-y-2 overflow-y-auto lg:w-72 xl:w-80">
            {CATEGORIES.map((cat) => {
              const CatIcon = cat.icon;
              const isOpen = openCategories[cat.id] ?? true;
              return (
                <div key={cat.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left"
                  >
                    <CatIcon className={`h-4 w-4 shrink-0 ${cat.color}`} />
                    <span className="flex-1 text-sm font-semibold text-slate-800">{cat.label}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                      {cat.templates.length}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 pb-1.5">
                      {cat.templates.map((tpl) => {
                        const isSelected = selected === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => void loadPreview(tpl.id)}
                            className={`w-full px-4 py-2.5 text-left transition ${
                              isSelected
                                ? "bg-[#2f4d6b]/5"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div
                                className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                                  isSelected ? "bg-[#2f4d6b]" : "bg-slate-300"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-sm font-medium leading-tight ${
                                      isSelected ? "text-[#2f4d6b]" : "text-slate-800"
                                    }`}
                                  >
                                    {tpl.label}
                                  </span>
                                  {tpl.badge && (
                                    <span
                                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tpl.badgeColor}`}
                                    >
                                      {tpl.badge}
                                    </span>
                                  )}
                                  {isSelected && loading && (
                                    <Loader2 className="h-3 w-3 animate-spin text-[#2f4d6b]" />
                                  )}
                                  {isSelected && !loading && previewHtml && (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] leading-tight text-slate-400">
                                  {tpl.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right — Preview pane */}
          <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Preview header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-3.5">
              <div className="h-3 w-3 rounded-full bg-red-400/60" />
              <div className="h-3 w-3 rounded-full bg-amber-400/60" />
              <div className="h-3 w-3 rounded-full bg-emerald-400/60" />
              <div className="ml-2 min-w-0 flex-1">
                {previewSubject ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Sujet :</span>
                    <span className="truncate text-sm font-semibold text-slate-800">
                      {previewSubject}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">
                    {selected ? "Chargement…" : "Sélectionnez un email dans la liste"}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void sendTestEmail()}
                disabled={!previewHtml || testState === "sending"}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  testState === "sent"
                    ? "bg-emerald-100 text-emerald-700"
                    : testState === "error"
                      ? "bg-red-100 text-red-600"
                      : "bg-[#2f4d6b]/10 text-[#2f4d6b] hover:bg-[#2f4d6b]/20"
                }`}
              >
                {testState === "sending" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : testState === "sent" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <SendHorizonal className="h-3.5 w-3.5" />
                )}
                {testState === "sending"
                  ? "Envoi…"
                  : testState === "sent"
                    ? "Envoyé ✓"
                    : testState === "error"
                      ? "Erreur"
                      : "Envoyer test"}
              </button>
            </div>

            {/* Preview body */}
            {!selected && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Mail className="h-7 w-7 text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Sélectionnez un email</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Cliquez sur un template dans la liste pour voir son rendu avec des données de démonstration.
                  </p>
                </div>
              </div>
            )}

            {selected && loading && (
              <div className="flex flex-1 items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#2f4d6b]" />
                <span className="text-sm font-medium">Rendu en cours…</span>
              </div>
            )}

            {selected && !loading && previewHtml === null && (
              <div className="flex flex-1 items-center justify-center text-sm text-red-500">
                Erreur lors du rendu de l&apos;email.
              </div>
            )}

            {previewHtml !== null && !loading && (
              <div className="flex-1 overflow-hidden rounded-b-2xl">
                <iframe
                  ref={iframeRef}
                  title="Aperçu email"
                  className="h-full min-h-[600px] w-full border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
