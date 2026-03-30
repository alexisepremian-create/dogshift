import { statusMeta, type BookingStatus } from "./status";
import type { CSSProperties } from "react";
import { Trash2 } from "lucide-react";

export type HostRequest = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string | null;
  conversationId?: string | null;
  status: BookingStatus;
  service: string | null;
  startDate: string | null;
  endDate: string | null;
  message: string | null;
  amount: number;
  currency: string;
  owner: { id: string; name: string; avatarUrl: string | null };
};

function formatDateHuman(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "—";
  const [y, m, d] = value.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dt);
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

export function RequestListItem({
  request,
  selected,
  onSelect,
  canArchive,
  onArchive,
  canDelete,
  onDelete,
  outerRef,
  style,
  dragAttributes,
  dragListeners,
  dragging,
}: {
  request: HostRequest;
  selected: boolean;
  onSelect: () => void;
  canArchive?: boolean;
  onArchive?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
  outerRef?: (node: HTMLDivElement | null) => void;
  style?: CSSProperties;
  dragAttributes?: Record<string, unknown>;
  dragListeners?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const meta = statusMeta(request.status);
  const status = String(request.status);
  const refundNote =
    status === "REFUNDED"
      ? "Remboursée au propriétaire"
      : status === "REFUND_FAILED"
        ? "Remboursement au propriétaire: échoué"
        : null;
  const start = request.startDate ? request.startDate.slice(0, 10) : "";
  const end = request.endDate ? request.endDate.slice(0, 10) : "";
  const when = start ? `${formatDateHuman(start)}${end ? ` → ${formatDateHuman(end)}` : ""}` : "—";
  const service = request.service?.trim() ? request.service.trim() : "Service";

  const border = selected ? "border-[var(--dogshift-blue)] ring-1 ring-[var(--dogshift-blue)] shadow-md" : "border-slate-100 shadow-sm";
  const bg = selected ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_97%)]" : "bg-white";

  const dragFx = dragging ? "shadow-lg ring-2 ring-[var(--dogshift-blue)] scale-[1.02] rotate-[0.5deg] opacity-90 z-50" : "";

  const canShowArchive = Boolean(onArchive);
  const canShowDelete = Boolean(onDelete);
  const canArchiveThis = status !== "PENDING_ACCEPTANCE" && status !== "CONFIRMED";

  return (
    <div
      ref={outerRef}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={style}
      {...(dragAttributes as any)}
      {...(dragListeners as any)}
      className={`group relative w-full rounded-2xl border ${border} ${bg} p-4 text-left transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${!selected && 'hover:scale-[1.01] hover:border-slate-200 hover:shadow-[0_8px_30px_-16px_rgba(2,6,23,0.12)]'} focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dogshift-blue)] ${dragFx} cursor-pointer`}
    >
      {canShowArchive && canArchiveThis && !request.archivedAt ? (
        <button
          type="button"
          title="Archiver"
          aria-label="Archiver"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onArchive?.();
          }}
          className="pointer-events-auto absolute -left-2 -top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-slate-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}

      {canShowDelete && onDelete && request.archivedAt ? (
        <button
          type="button"
          title="Supprimer définitivement"
          aria-label="Supprimer définitivement"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="pointer-events-none absolute -left-2 -top-2 z-10 inline-flex h-8 w-8 scale-95 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition-all duration-150 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 hover:text-rose-600 hover:shadow-md"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}

      <div className="flex items-start gap-3">
        {request.owner.avatarUrl ? (
          <img
            src={request.owner.avatarUrl}
            alt=""
            className="mt-0.5 h-9 w-9 rounded-full border border-slate-200 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
            {request.owner.name.trim().slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900 group-hover:text-[var(--dogshift-blue)] transition-colors duration-300">{request.owner.name}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                {service === "Promenade" && <span className="text-[14px]">🚶</span>}
                {service === "Garde" && <span className="text-[14px]">🏡</span>}
                {service === "Pension" && <span className="text-[14px]">🌙</span>}
                <span className="truncate">{service} • {when}</span>
              </div>
            </div>

            <div className="shrink-0 text-right transition-transform duration-300 group-hover:-translate-x-1">
              <p className="text-sm font-semibold text-slate-900">{formatChfCents(request.amount)}</p>
              <div className="mt-2 flex justify-end">
                <span className={meta.classes}>{meta.label}</span>
              </div>
              {refundNote ? <p className="mt-1 text-[11px] font-medium text-slate-500">{refundNote}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
