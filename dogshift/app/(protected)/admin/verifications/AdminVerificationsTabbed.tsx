"use client";

import { useState } from "react";
import { ShieldCheck, UserCheck, Dog } from "lucide-react";
import AdminVerificationsClient from "./AdminVerificationsClient";
import AdminPensionVerificationsClient from "../pension-verifications/AdminPensionVerificationsClient";
import AdminMaxDogsCertsClient from "../max-dogs-certs/AdminMaxDogsCertsClient";

type TopTab = "identity" | "pension" | "maxdogs";

export default function AdminVerificationsTabbed() {
  const [tab, setTab] = useState<TopTab>("identity");

  return (
    <div>
      {/* Top-level tab bar */}
      <div className="mb-4 flex flex-wrap gap-2">
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
        <button
          type="button"
          onClick={() => setTab("maxdogs")}
          className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
            tab === "maxdogs"
              ? "bg-slate-900 text-white shadow"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Dog className="h-4 w-4" />
          Certificat OPAn (&gt;5 chiens)
        </button>
      </div>

      {tab === "identity" ? (
        <AdminVerificationsClient />
      ) : tab === "pension" ? (
        <AdminPensionVerificationsClient />
      ) : (
        <AdminMaxDogsCertsClient />
      )}
    </div>
  );
}
