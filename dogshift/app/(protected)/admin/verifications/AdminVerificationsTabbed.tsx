"use client";

import { useState } from "react";
import { ShieldCheck, UserCheck } from "lucide-react";
import AdminVerificationsClient from "./AdminVerificationsClient";
import AdminPensionVerificationsClient from "../pension-verifications/AdminPensionVerificationsClient";

type TopTab = "identity" | "pension";

export default function AdminVerificationsTabbed() {
  const [tab, setTab] = useState<TopTab>("identity");

  return (
    <div>
      {/* Top-level tab bar */}
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("identity")}
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
            tab === "identity"
              ? "bg-slate-900 text-white shadow"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Vérification identité
        </button>
        <button
          type="button"
          onClick={() => setTab("pension")}
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
            tab === "pension"
              ? "bg-slate-900 text-white shadow"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Vérification Pension
        </button>
      </div>

      {tab === "identity" ? <AdminVerificationsClient /> : <AdminPensionVerificationsClient />}
    </div>
  );
}
