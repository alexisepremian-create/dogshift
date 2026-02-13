import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { statusMeta, type BookingStatus } from "./status";
import type { HostRequest } from "./RequestListItem";

function formatDateHuman(value: string) {
  if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(value)) return value || "—";
  const [y, m, d] = value.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
}

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

function formatChfCents(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(value / 100);
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <p className="text-slate-600">{label}</p>
      <p className="text-right font-semibold text-slate-900">{value}</p>
    </div>
  );
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
  const [decisionLoading, setDecisionLoading] = useState<"ACCEPT" | "DECLINE" | null>(null);
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

    const start = request.startDate ? formatDateTimeHuman(request.startDate) : "—";
    const end = request.endDate ? formatDateTimeHuman(request.endDate) : "—";
    const createdAt = request.createdAt ? formatDateTimeHuman(request.createdAt) : "—";

    return { meta, service, start, end, createdAt };
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
  const isDone = effectiveStatus === "CANCELLED" || effectiveStatus === "REFUNDED" || effectiveStatus === "REFUND_FAILED";
  const hasActions = isToAccept || isPendingPayment || isDone;

  const refundNote =
    effectiveStatus === "REFUNDED"
      ? "Remboursée au propriétaire"
      : effectiveStatus === "REFUND_FAILED"
        ? "Remboursement au propriétaire: échoué"
        : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tracking-tight text-slate-900">{request.owner.name}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={content.meta.classes}>{content.meta.label}</span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-slate-700">
              {formatChfCents(request.amount)}
            </span>
          </div>
          {refundNote ? <p className="mt-2 text-xs font-medium text-slate-500">{refundNote}</p> : null}
        </div>

        {onCloseMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
          >
            Retour
          </button>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <p className="text-sm font-semibold text-slate-900">Résumé</p>
          <div className="mt-3 space-y-2">
            <SummaryRow label="Service" value={content.service} />
            <SummaryRow label="Début" value={content.start} />
            <SummaryRow label="Fin" value={content.end} />
            <SummaryRow label="Créée" value={content.createdAt} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <p className="text-sm font-semibold text-slate-900">Montant</p>
          <div className="mt-3 space-y-2">
            <SummaryRow label="Total" value={formatChfCents(request.amount)} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Référence</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-600">{request.id}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(request.id);
                setCopied(ok);
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
            >
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </section>

        {request.message?.trim() ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <p className="text-sm font-semibold text-slate-900">Message</p>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{request.message}</p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
          <p className="text-sm font-semibold text-slate-900">Messages</p>
          <p className="mt-2 text-sm text-slate-600">Ouvre la conversation avec ce client.</p>
          <p className="mt-1 text-xs text-slate-500">Dernière activité: —</p>
          <div className="mt-4">
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
              className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {opening ? "Ouverture…" : request.conversationId ? "Voir la conversation" : "Entamer une discussion"}
            </button>
          </div>
        </section>

        {hasActions ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <p className="text-sm font-semibold text-slate-900">Actions</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {isToAccept ? (
                <>
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
                    className="inline-flex items-center justify-center rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[color-mix(in_srgb,var(--dogshift-blue),transparent_75%)] transition hover:bg-[var(--dogshift-blue-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {decisionLoading === "ACCEPT" ? "Acceptation…" : "Accepter"}
                  </button>
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
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {decisionLoading === "DECLINE" ? "Refus…" : "Refuser"}
                  </button>
                </>
              ) : null}

              {isPendingPayment ? (
                <button
                  type="button"
                  disabled
                  title="En attente du webhook Stripe"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm opacity-60"
                >
                  Rappeler le paiement
                </button>
              ) : null}

              {isDone ? (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Archiver
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
