"use client";

import { Maximize2, Minimize2 } from "lucide-react";

export default function ConversationExpandToggle({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      aria-label={isExpanded ? "Réduire la conversation" : "Agrandir la conversation"}
      title={isExpanded ? "Réduire" : "Agrandir"}
    >
      {isExpanded ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
