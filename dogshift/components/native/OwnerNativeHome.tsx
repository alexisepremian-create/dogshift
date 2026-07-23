"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentType } from "react";
import { CalendarDays, ChevronRight, CreditCard, Dog, MessageCircle, Search, Settings, Wallet } from "lucide-react";

import { NativeDashTile, NativeStat } from "@/components/native/NativeDashTile";
import { DashboardSheet } from "@/components/native/DashboardSheet";
import { prefetchOwnerBookings } from "@/lib/account/ownerBookingsCache";

const PanelLoading = () => (
  <div className="flex min-h-[55vh] items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
  </div>
);

// Import factories kept separate from dynamic() so we can PREFETCH each chunk on
// idle — a warmed chunk makes dynamic() resolve instantly on tap, so PanelLoading
// never paints and the panel shows ONE continuous spinner instead of a
// PanelLoading→page-spinner swap that reset the rotation on heavy pages.
const PANEL_IMPORTERS = {
  bookings: () => import("@/app/(marketing)/account/bookings/page"),
  messages: () => import("@/app/(marketing)/account/messages/page"),
  dogs: () => import("@/app/(marketing)/account/dogs/page"),
  wallet: () => import("@/app/(marketing)/account/wallet/page"),
  settings: () => import("@/app/(marketing)/account/settings/page"),
} as const;

const PANELS: Record<string, { title: string; Component: ComponentType }> = {
  bookings: { title: "Réservations", Component: dynamic(PANEL_IMPORTERS.bookings, { ssr: false, loading: PanelLoading }) },
  messages: { title: "Messages", Component: dynamic(PANEL_IMPORTERS.messages, { ssr: false, loading: PanelLoading }) },
  dogs: { title: "Mes chiens", Component: dynamic(PANEL_IMPORTERS.dogs, { ssr: false, loading: PanelLoading }) },
  wallet: { title: "Portefeuille", Component: dynamic(PANEL_IMPORTERS.wallet, { ssr: false, loading: PanelLoading }) },
  settings: { title: "Paramètres", Component: dynamic(PANEL_IMPORTERS.settings, { ssr: false, loading: PanelLoading }) },
};

export function OwnerNativeHome({
  firstName,
  pendingPayment,
  pendingAcceptance,
  confirmed,
  unreadMessages,
  nextBooking,
}: {
  firstName: string;
  pendingPayment: number;
  pendingAcceptance: number;
  confirmed: number;
  unreadMessages: number;
  nextBooking: { id: string; label: string; sitterName: string } | null;
}) {
  const [panel, setPanel] = useState<string | null>(null);
  const active = panel ? PANELS[panel] : null;
  const ActiveComponent = active?.Component ?? null;

  // Warm the Réservations list in the background while the owner is on the
  // dashboard, so tapping the "Réservations" tab (a full route) paints instantly
  // instead of waiting on a fresh fetch.
  useEffect(() => {
    void prefetchOwnerBookings();
  }, []);

  // Prefetch the dashboard-tile panel chunks on idle so the first tap opens
  // instantly with a single, uninterrupted spinner (no PanelLoading swap).
  useEffect(() => {
    const run = () => { for (const load of Object.values(PANEL_IMPORTERS)) void load(); };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(run);
      return;
    }
    const t = setTimeout(run, 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-4 pb-2" data-testid="account-dashboard-native">
      <div>
        <p className="text-sm text-slate-500">Bonjour</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{firstName || ""}</p>
      </div>

      {pendingPayment > 0 ? (
        <Link href="/account/bookings?tab=pending&pending=payment" className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 active:bg-amber-100">
          <CreditCard className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="text-sm font-semibold text-amber-900">
            {pendingPayment} réservation{pendingPayment > 1 ? "s" : ""} à payer
          </span>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        </Link>
      ) : null}

      {nextBooking ? (
        <button
          type="button"
          onClick={() => setPanel("bookings")}
          className="block w-full rounded-3xl bg-[#7c3aed] p-4 text-left text-white shadow-[0_16px_40px_-18px_rgba(124,58,237,0.7)] active:bg-[#6d28d9]"
        >
          <p className="text-xs font-medium text-white/70">Prochaine réservation</p>
          <p className="mt-1 text-base font-bold">{nextBooking.label}</p>
          <p className="mt-0.5 text-sm text-white/80">{nextBooking.sitterName}</p>
        </button>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <NativeStat value={pendingAcceptance} label="En attente" />
        <NativeStat value={confirmed} label="Confirmées" />
        <NativeStat value={unreadMessages} label="Messages" />
      </div>

      <p className="pt-1 text-sm font-semibold text-slate-900">Accès rapide</p>

      <div className="grid grid-cols-2 gap-3">
        <NativeDashTile href="/" label="Réserver" icon={<Search className="h-5 w-5" />} variant="primary" />
        <NativeDashTile onClick={() => setPanel("bookings")} label="Réservations" icon={<CalendarDays className="h-5 w-5" />} />
        <NativeDashTile onClick={() => setPanel("messages")} label="Messages" icon={<MessageCircle className="h-5 w-5" />} badge={unreadMessages} />
        <NativeDashTile onClick={() => setPanel("dogs")} label="Mes chiens" icon={<Dog className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NativeDashTile onClick={() => setPanel("wallet")} label="Portefeuille" icon={<Wallet className="h-5 w-5" />} variant="ghost" />
        <NativeDashTile onClick={() => setPanel("settings")} label="Paramètres" icon={<Settings className="h-5 w-5" />} variant="ghost" />
      </div>

      <DashboardSheet open={active != null} title={active?.title ?? ""} onClose={() => setPanel(null)}>
        {ActiveComponent ? <ActiveComponent /> : null}
      </DashboardSheet>
    </div>
  );
}
