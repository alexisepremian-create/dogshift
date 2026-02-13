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
      label: "En attente d’acceptation",
      classes:
        "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-amber-800",
    };
  }

  if (status === "PENDING_PAYMENT") {
    return {
      label: "En attente paiement",
      classes:
        "inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-amber-800",
    };
  }

  if (status === "CONFIRMED") {
    return {
      label: "Confirmée",
      classes:
        "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-emerald-800",
    };
  }

  if (status === "PAYMENT_FAILED") {
    return {
      label: "Paiement refusé",
      classes:
        "inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-rose-800",
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "Annulée",
      classes:
        "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-slate-700",
    };
  }

  if (status === "REFUNDED") {
    return {
      label: "Annulée",
      classes:
        "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-slate-700",
    };
  }

  if (status === "REFUND_FAILED") {
    return {
      label: "Annulée",
      classes:
        "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold leading-5 text-slate-700",
    };
  }

  if (status === "DRAFT") {
    return {
      label: "Brouillon",
      classes:
        "inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold leading-5 text-slate-700",
    };
  }

  return {
    label: String(status || "—"),
    classes:
      "inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold leading-5 text-slate-700",
  };
}
