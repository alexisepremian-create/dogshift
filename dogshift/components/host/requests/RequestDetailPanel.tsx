import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ClipboardList, CalendarClock, Banknote, Hash, MessageCircle, MessageSquareShare, Info, X, Trash2, CheckCircle2, HandCoins, ShieldCheck, Clock, XCircle, PawPrint, Phone, Syringe, AlertTriangle, Heart, UtensilsCrossed, StickyNote } from "lucide-react";

import { statusMeta, type BookingStatus } from "./status";
import type { HostRequest } from "./RequestListItem";

function formatDateTimeHuman(iso: string) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;

  const hours = dt.getHours();
  const minutes = dt.getMinutes();
  const hasTime = hours !== 0 || minutes !== 0;

  const datePart = new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);

  if (!hasTime) return datePart;

  const timePart = new Intl.DateTimeFormat("fr-CH", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);

  return `${datePart} à ${timePart}`;
}

function formatDateRange(startIso: string | null, endIso: string | null) {
  if (!startIso) return "—";
  const startDt = new Date(startIso);
  const endDt = endIso ? new Date(endIso) : null;
  if (Number.isNaN(startDt.getTime())) return "—";

  const dOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const tOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  const sDate = new Intl.DateTimeFormat("fr-CH", dOpts).format(startDt);
  const sTime = (startDt.getHours() !== 0 || startDt.getMinutes() !== 0) ? new Intl.DateTimeFormat("fr-CH", tOpts).format(startDt) : null;

  if (!endDt || Number.isNaN(endDt.getTime())) {
    return sTime ? `${sDate} à ${sTime}` : sDate;
  }

  const eDate = new Intl.DateTimeFormat("fr-CH", dOpts).format(endDt);
  const eTime = (endDt.getHours() !== 0 || endDt.getMinutes() !== 0) ? new Intl.DateTimeFormat("fr-CH", tOpts).format(endDt) : null;

  if (sDate === eDate) {
    if (sTime && eTime) return `${sDate} • ${sTime} à ${eTime}`;
    return sDate;
  }

  const sFull = sTime ? `${sDate} à ${sTime}` : sDate;
  const eFull = eTime ? `${eDate} à ${eTime}` : eDate;
  return `${sFull} → ${eFull}`;
}

function formatChfCents(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(value / 100);
}


async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function RequestDetailPanel({
  request,
  onCloseMobile,
  onStatusChange,
  onRefresh,
}: {
  request: HostRequest | null;
  onCloseMobile?: () => void;
  onStatusChange?: (id: string, status: string) => void;
  onRefresh?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState<"ACCEPT" | "DECLINE" | "CANCEL_CONFIRMED" | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setLocalStatus(null);
    setDecisionLoading(null);
  }, [request?.id]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const content = useMemo(() => {
    if (!request) return null;

    const effectiveStatus = (localStatus ?? request.status) as BookingStatus;
    const meta = statusMeta(effectiveStatus);
    const service = request.service?.trim() ? request.service.trim() : "Service";

    const dateRange = formatDateRange(request.startDate, request.endDate);
    const createdAt = request.createdAt ? formatDateTimeHuman(request.createdAt) : "—";

    return { meta, service, dateRange, createdAt };
  }, [request, localStatus]);

  if (!request || !content) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Sélectionne une demande</p>
        <p className="mt-2 text-sm text-slate-600">Choisis une demande à gauche pour voir le détail.</p>
      </div>
    );
  }

  const effectiveStatus = localStatus ?? request.status;
  const isPendingPayment = effectiveStatus === "PENDING_PAYMENT" || effectiveStatus === "DRAFT";
  const isToAccept = effectiveStatus === "PENDING_ACCEPTANCE" || effectiveStatus === "PAID";
  const isConfirmedBooking = effectiveStatus === "CONFIRMED";
  const isDone = effectiveStatus === "CANCELLED" || effectiveStatus === "REFUNDED" || effectiveStatus === "REFUND_FAILED";
  const hasActions = isToAccept || isPendingPayment || isDone || isConfirmedBooking;

  const refundNote =
    effectiveStatus === "REFUNDED"
      ? "Remboursée au propriétaire"
      : effectiveStatus === "REFUND_FAILED"
        ? "Remboursement au propriétaire: échoué"
        : null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white/60 p-4 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6 transition-all duration-500">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tracking-tight text-slate-900">{request.owner.name}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 shadow-sm ${
              effectiveStatus === "CONFIRMED" ? "border-emerald-200 bg-emerald-50/50 text-emerald-800" :
              (effectiveStatus === "PENDING_ACCEPTANCE" || effectiveStatus === "PAID" || effectiveStatus === "PENDING_PAYMENT") ? "border-amber-200 bg-amber-50/50 text-amber-800" :
              (effectiveStatus === "CANCELLED" || effectiveStatus === "REFUNDED" || effectiveStatus === "REFUND_FAILED") ? "border-slate-200 bg-slate-50 text-slate-700" :
              effectiveStatus === "PAYMENT_FAILED" ? "border-rose-200 bg-rose-50/50 text-rose-800" :
              "border-slate-200 bg-white text-slate-700"
            }`}>
              <div className={`${
                effectiveStatus === "CONFIRMED" ? "text-emerald-600" :
                (effectiveStatus === "PENDING_ACCEPTANCE" || effectiveStatus === "PAID" || effectiveStatus === "PENDING_PAYMENT") ? "text-amber-600" :
                (effectiveStatus === "CANCELLED" || effectiveStatus === "REFUNDED" || effectiveStatus === "REFUND_FAILED") ? "text-slate-500" :
                effectiveStatus === "PAYMENT_FAILED" ? "text-rose-600" :
                "text-slate-500"
              }`}>
                {effectiveStatus === "CONFIRMED" ? <CheckCircle2 className="h-5 w-5" /> : 
                 (effectiveStatus === "PENDING_ACCEPTANCE" || effectiveStatus === "PAID" || effectiveStatus === "PENDING_PAYMENT") ? <Clock className="h-5 w-5" /> :
                 (effectiveStatus === "CANCELLED" || effectiveStatus === "REFUNDED" || effectiveStatus === "REFUND_FAILED") ? <XCircle className="h-5 w-5" /> :
                 <Info className="h-5 w-5" />}
              </div>
              <span className="text-[14px] font-bold tracking-wide">{content.meta.label}</span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 shadow-sm">
              <Banknote className="h-5 w-5 text-slate-500" />
              <span className="text-[15px] font-bold tracking-wide text-slate-900">{formatChfCents(request.amount)}</span>
            </div>
          </div>
          {refundNote ? <p className="mt-2 text-xs font-medium text-slate-500">{refundNote}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {effectiveStatus !== "CONFIRMED" ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 hover:scale-105 active:scale-95 shadow-sm"
              title="Supprimer la réservation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
          {onCloseMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 hover:scale-105 active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-200">
        <section 
          className="group relative bg-white z-10"
          style={{ perspective: "1500px" }}
        >
          <div 
            className="relative w-full transition-transform duration-[800ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ 
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
            }}
          >
            {/* FRONT FACE */}
            <div 
              className="w-full p-5 sm:p-6"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  Détails de la réservation
                </p>
                <button
                  type="button"
                  onClick={() => setIsFlipped(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-all hover:bg-slate-100 hover:text-[var(--dogshift-blue)] hover:scale-110 active:scale-95"
                  title="Voir la référence"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Service & Date
                  </p>
                  <p className="text-[15px] font-bold text-slate-900">{content.service}</p>
                  <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">{content.dateRange}</p>
                </div>
                
                <div className="rounded-2xl bg-slate-50/50 p-4 border border-slate-100/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5" />
                    Paiement
                  </p>
                  <p className="text-[15px] font-bold text-slate-900">{formatChfCents(request.amount)} <span className="text-xs text-slate-400 font-medium ml-1">(0.00 CHF de frais)</span></p>
                  <p className="text-xs font-medium text-slate-600 mt-1">Sécurisé via Stripe</p>
                </div>
              </div>
            </div>

            {/* BACK FACE */}
            <div 
              className={`absolute inset-0 w-full h-full p-5 sm:p-6 bg-slate-50 flex flex-col ${!isFlipped ? 'pointer-events-none' : ''}`}
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                    <Hash className="h-4 w-4" />
                  </span>
                  Référence de transaction
                </p>
                <button
                  type="button"
                  onClick={() => setIsFlipped(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 hover:scale-110 active:scale-95 shadow-sm"
                  title="Retour"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4 mt-2">
                <p className="text-xs font-medium text-slate-500">Identifiant unique à communiquer au support en cas de besoin.</p>
                
                <div className="flex items-center justify-between gap-3 bg-white p-2 pl-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="font-mono text-xs font-medium text-slate-700 break-all">{request.id}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(request.id);
                      setCopied(ok);
                    }}
                    className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 border border-slate-100"
                  >
                    {copied ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 text-emerald-600" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {request.message?.trim() ? (
          <section className="group border-t border-slate-100 bg-white p-5 transition-colors hover:bg-slate-50/50">
            <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <MessageSquareShare className="h-3.5 w-3.5" />
              </span>
              Message
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="whitespace-pre-line text-sm text-slate-700 italic">&ldquo;{request.message}&rdquo;</p>
            </div>
          </section>
        ) : null}

        <section className="border-t border-slate-100 bg-slate-50/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-slate-50/80">
          <div className="w-full sm:w-auto flex-shrink-0">
            <button
              type="button"
              disabled={opening}
              onClick={async () => {
                if (opening) return;
                if (request.conversationId) {
                  router.push(`/host/messages/${encodeURIComponent(request.conversationId)}`);
                  return;
                }
                setOpening(true);
                try {
                  const res = await fetch("/api/host/messages/conversations/start", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ownerId: request.owner.id, bookingId: request.id }),
                  });
                  const payload = (await res.json()) as { ok?: boolean; conversationId?: string };
                  if (res.ok && payload.ok && typeof payload.conversationId === "string" && payload.conversationId.trim()) {
                    router.push(`/host/messages/${encodeURIComponent(payload.conversationId)}`);
                    return;
                  }
                  router.push("/host/messages");
                } catch {
                  router.push("/host/messages");
                } finally {
                  setOpening(false);
                }
              }}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageCircle className="h-4 w-4" />
              {opening ? "Ouverture…" : request.conversationId ? "Voir la conversation" : "Entamer une discussion"}
            </button>
          </div>

          {hasActions ? (
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2 justify-end">
              {isConfirmedBooking ? (
                <button
                  type="button"
                  disabled={decisionLoading !== null}
                  onClick={() => setConfirmCancelOpen(true)}
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-900 shadow-sm transition hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Annuler & Rembourser
                </button>
              ) : null}

              {isToAccept ? (
                <div className="flex w-full sm:w-auto items-center gap-2">
                  <button
                    type="button"
                    disabled={decisionLoading !== null}
                    onClick={async () => {
                      if (decisionLoading) return;
                      setDecisionLoading("DECLINE");
                      setLocalStatus("CANCELLED");
                      try {
                        const res = await fetch(`/api/host/requests/${encodeURIComponent(request.id)}/decline`, { method: "POST" });
                        const payload = (await res.json()) as { ok?: boolean; status?: string };
                        if (!res.ok || !payload.ok) {
                          setLocalStatus(null);
                          return;
                        }
                        const nextStatus = typeof payload.status === "string" && payload.status.trim() ? payload.status.trim() : "CANCELLED";
                        onStatusChange?.(request.id, nextStatus);
                        setLocalStatus(nextStatus);
                        onRefresh?.();
                      } catch {
                        setLocalStatus(null);
                      } finally {
                        setDecisionLoading(null);
                      }
                    }}
                    className="inline-flex flex-1 sm:flex-auto items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {decisionLoading === "DECLINE" ? "Refus…" : "Refuser"}
                  </button>
                  <button
                    type="button"
                    disabled={decisionLoading !== null}
                    onClick={async () => {
                      if (decisionLoading) return;
                      setDecisionLoading("ACCEPT");
                      setLocalStatus("CONFIRMED");
                      try {
                        const res = await fetch(`/api/host/requests/${encodeURIComponent(request.id)}/accept`, { method: "POST" });
                        const payload = (await res.json()) as { ok?: boolean; status?: string };
                        if (!res.ok || !payload.ok) {
                          setLocalStatus(null);
                          return;
                        }
                        const nextStatus = typeof payload.status === "string" && payload.status.trim() ? payload.status.trim() : "CONFIRMED";
                        onStatusChange?.(request.id, nextStatus);
                        setLocalStatus(nextStatus);
                        onRefresh?.();
                      } catch {
                        setLocalStatus(null);
                      } finally {
                        setDecisionLoading(null);
                      }
                    }}
                    className="inline-flex flex-1 sm:flex-auto items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 transition hover:bg-emerald-600 hover:shadow-emerald-600/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {decisionLoading === "ACCEPT" ? "Acceptation…" : "Accepter"}
                  </button>
                </div>
              ) : null}

              {isPendingPayment ? (
                <button
                  type="button"
                  disabled
                  title="En attente du webhook Stripe"
                  className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-500 shadow-sm opacity-60"
                >
                  Rappeler le paiement
                </button>
              ) : null}

            </div>
          ) : null}
        </section>
      </div>

      <div className={`fixed inset-0 z-[90] ${confirmCancelOpen ? "" : "hidden"}`}>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => {
            if (decisionLoading) return;
            setConfirmCancelOpen(false);
          }}
          className="absolute inset-0 bg-black/40"
        />
        <div className="absolute left-1/2 top-1/2 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.35)]">
          <p className="text-sm font-semibold text-slate-900">Annuler cette réservation confirmée&nbsp;?</p>
          <p className="mt-2 text-sm text-slate-600">
            Le propriétaire sera remboursé intégralement (même montant que le paiement). Utilise cette action seulement si tu ne
            peux pas honorer la prestation. Le crédit sur son compte peut prendre quelques jours ouvrables.
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={decisionLoading !== null}
              onClick={() => setConfirmCancelOpen(false)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retour
            </button>
            <button
              type="button"
              disabled={decisionLoading !== null}
              onClick={async () => {
                if (decisionLoading) return;
                setDecisionLoading("CANCEL_CONFIRMED");
                try {
                  const res = await fetch(`/api/host/requests/${encodeURIComponent(request.id)}/cancel-confirmed`, {
                    method: "POST",
                  });
                  const payload = (await res.json()) as {
                    ok?: boolean;
                    status?: string;
                    error?: string;
                    message?: string;
                  };
                  if (!res.ok || !payload.ok) {
                    setDecisionLoading(null);
                    return;
                  }
                  const nextStatus =
                    typeof payload.status === "string" && payload.status.trim() ? payload.status.trim() : "REFUNDED";
                  setConfirmCancelOpen(false);
                  onStatusChange?.(request.id, nextStatus);
                  setLocalStatus(nextStatus);
                  onRefresh?.();
                } catch {
                  setDecisionLoading(null);
                } finally {
                  setDecisionLoading(null);
                }
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {decisionLoading === "CANCEL_CONFIRMED" ? "Annulation…" : "Confirmer l’annulation"}
            </button>
          </div>
        </div>
      </div>

      {request.dog ? (
        <div className="mt-6 rounded-3xl border border-slate-100 bg-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-200">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-amber-50/40 px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 shrink-0">
              <PawPrint className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                {request.dog.name}
                {request.dog.breed ? <span className="ml-2 text-xs font-medium text-slate-500">— {request.dog.breed}</span> : null}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {request.dog.birthYear ? `Né(e) en ${request.dog.birthYear}` : null}
                {request.dog.birthYear && request.dog.weightKg ? " · " : null}
                {request.dog.weightKg ? `${request.dog.weightKg} kg` : null}
                {(request.dog.birthYear || request.dog.weightKg) && request.dog.neutered !== null
                  ? " · "
                  : null}
                {request.dog.neutered === true
                  ? "Castré(e)"
                  : request.dog.neutered === false
                    ? "Non castré(e)"
                    : null}
              </p>
            </div>
            {request.dog.photoUrl ? (
              <Image
                src={request.dog.photoUrl}
                alt={request.dog.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm shrink-0"
                unoptimized
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 border-2 border-white shadow-sm">
                <PawPrint className="h-6 w-6 text-amber-500" />
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-50">
            {request.dog.sitterInstructions?.trim() ? (
              <div className="flex gap-3 px-5 py-4">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Instructions du propriétaire</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{request.dog.sitterInstructions}</p>
                </div>
              </div>
            ) : null}

            {request.dog.behaviorNotes?.trim() ? (
              <div className="flex gap-3 px-5 py-4">
                <Heart className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Comportement</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{request.dog.behaviorNotes}</p>
                </div>
              </div>
            ) : null}

            {request.dog.feedingNotes?.trim() ? (
              <div className="flex gap-3 px-5 py-4">
                <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Alimentation</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{request.dog.feedingNotes}</p>
                </div>
              </div>
            ) : null}

            {request.dog.medications?.trim() ? (
              <div className="flex gap-3 px-5 py-4">
                <Syringe className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Médicaments</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{request.dog.medications}</p>
                </div>
              </div>
            ) : null}

            {request.dog.allergies?.trim() ? (
              <div className="flex gap-3 px-5 py-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Allergies</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{request.dog.allergies}</p>
                </div>
              </div>
            ) : null}

            {request.dog.vetContact?.trim() ? (
              <div className="flex gap-3 px-5 py-4">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Contact vétérinaire</p>
                  <p className="text-sm text-slate-700">{request.dog.vetContact}</p>
                </div>
              </div>
            ) : null}

            {request.ownerPhone?.trim() ? (
              <div className="flex gap-3 px-5 py-4">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Téléphone du propriétaire</p>
                  <a
                    href={`tel:${request.ownerPhone}`}
                    className="text-sm font-medium text-[var(--dogshift-blue)] hover:underline"
                  >
                    {request.ownerPhone}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-3xl border border-slate-100 bg-white/60 p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:shadow-md hover:border-slate-200">
        <p className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Info className="h-4 w-4" />
          </span>
          Comment ça marche ?
        </p>
        
        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-100 shadow-sm mt-0.5">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">1. Acceptation</p>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">Une fois la demande acceptée, le créneau est bloqué et la réservation est confirmée.</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-100 shadow-sm mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">2. Prestation & Sécurité</p>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">Le paiement du client est déjà sécurisé sur un compte de cantonnement Stripe.</p>
            </div>
          </div>
          
          <div className="flex gap-4 items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 border border-slate-100 shadow-sm mt-0.5">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">3. Versement</p>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">L&apos;argent est versé automatiquement sur ton compte bancaire 48h après la fin du service.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
