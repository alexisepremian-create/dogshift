"use client";

import { useSession } from "next-auth/react";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";

import SunCornerGlow from "@/components/SunCornerGlow";

export default function OwnerWalletPage() {
  const { status: sessionStatus } = useSession();

  if (sessionStatus !== "authenticated") return null;

  return (
    <div className="relative grid gap-6 overflow-hidden" data-testid="owner-wallet-page">
      <SunCornerGlow variant="ownerDashboard" />

      <div className="relative z-10 grid gap-6">
        <div>
          <p className="text-sm font-semibold text-slate-600">Mon compte</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            <Wallet className="h-6 w-6 text-slate-700" aria-hidden="true" />
            <span>Portefeuille</span>
          </h1>
          <div className="mt-3 flex min-h-[32px] items-center">
            <p className="text-sm text-slate-600">Solde, paiements, remboursements et historique.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <p className="text-sm font-semibold text-slate-800">Solde</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">—</p>
            <p className="mt-2 text-xs font-medium text-slate-500">À venir</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Paiements</p>
              <ArrowUpRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">—</p>
            <p className="mt-2 text-xs font-medium text-slate-500">À venir</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Remboursements</p>
              <ArrowDownRight className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">—</p>
            <p className="mt-2 text-xs font-medium text-slate-500">À venir</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.2)]">
          <p className="text-sm font-semibold text-slate-800">Historique</p>
          <p className="mt-2 text-sm text-slate-600">Bientôt, tu verras ici toutes tes opérations.</p>
          <div className="mt-4 h-10 w-full rounded-2xl bg-slate-50" />
        </div>
      </div>
    </div>
  );
}
