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
  const start = request.startDate ? request.startDate.slice(0, 10) : "";
  const end = request.endDate ? request.endDate.slice(0, 10) : "";
  const when = start ? `${formatDateHuman(start)}${end ? ` → ${formatDateHuman(end)}` : ""}` : "—";
  const service = request.service?.trim() ? request.service.trim() : "Service";

  const border = selected ? "border-[color-mix(in_srgb,var(--dogshift-blue),black_10%)]" : "border-slate-200";
  const bg = selected ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_96%)]" : "bg-white";

  const dragFx = dragging ? "shadow-md ring-1 ring-slate-200 scale-[1.01] rotate-[0.4deg]" : "";

  const canShowArchive = Boolean(onArchive);
  const canShowDelete = Boolean(onDelete);
  const status = String(request.status);
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
      className={`group relative w-full rounded-2xl border ${border} ${bg} p-4 text-left shadow-sm transition-transform duration-150 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dogshift-blue)] ${dragFx}`}
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
              <p className="truncate text-sm font-semibold text-slate-900">{request.owner.name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-600">
                {service} • {when}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <p className="truncate font-mono text-[11px] text-slate-400" title={request.id}>
                  {request.id}
                </p>
                <button
                  type="button"
                  aria-label="Copier l’identifiant"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await copyToClipboard(request.id);
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M7.5 6.5A2.5 2.5 0 0110 4h4A2.5 2.5 0 0116.5 6.5v6A2.5 2.5 0 0114 15h-4A2.5 2.5 0 017.5 12.5v-6z" />
                    <path d="M6 6.5c0-.368.07-.72.197-1.044A2.5 2.5 0 004 8v6.5A2.5 2.5 0 006.5 17H11c.368 0 .72-.07 1.044-.197A2.5 2.5 0 018.5 14.5V8A2.5 2.5 0 016 6.5z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold text-slate-900">{formatChfCents(request.amount)}</p>
              <div className="mt-2 flex justify-end">
                <span className={meta.classes}>{meta.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
