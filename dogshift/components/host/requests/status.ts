export type BookingStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PENDING_ACCEPTANCE"
  | "PAID"
  | "CONFIRMED"
  | "PAYMENT_FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "REFUND_FAILED"
  | string;

export type StatusMeta = {
  label: string;
  classes: string;
};

export function statusMeta(status: BookingStatus): StatusMeta {
  if (status === "PENDING_ACCEPTANCE" || status === "PAID") {
    return {
      label: "En attente",
      classes:
        "inline-flex items-center rounded-lg border border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-100/50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-700 shadow-sm",
    };
  }

  if (status === "PENDING_PAYMENT") {
    return {
      label: "En attente paiement",
      classes:
        "inline-flex items-center rounded-lg border border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-100/50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-700 shadow-sm",
    };
  }

  if (status === "CONFIRMED") {
    return {
      label: "Confirmée",
      classes:
        "inline-flex items-center rounded-lg border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-emerald-100/50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-700 shadow-sm",
    };
  }

  if (status === "PAYMENT_FAILED") {
    return {
      label: "Paiement refusé",
      classes:
        "inline-flex items-center rounded-lg border border-rose-200/60 bg-gradient-to-r from-rose-50 to-rose-100/50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-rose-700 shadow-sm",
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "Annulée",
      classes:
        "inline-flex items-center rounded-lg border border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-600 shadow-sm",
    };
  }

  if (status === "REFUNDED") {
    return {
      label: "Remboursée",
      classes:
        "inline-flex items-center rounded-lg border border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-600 shadow-sm",
    };
  }

  if (status === "REFUND_FAILED") {
    return {
      label: "Annulée",
      classes:
        "inline-flex items-center rounded-lg border border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/50 px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-600 shadow-sm",
    };
  }

  if (status === "DRAFT") {
    return {
      label: "Brouillon",
      classes:
        "inline-flex items-center rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-500 shadow-sm",
    };
  }

  return {
    label: String(status || "—"),
    classes:
      "inline-flex items-center rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-500 shadow-sm",
  };
}
