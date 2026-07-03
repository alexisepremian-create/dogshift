"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, type ComponentType } from "react";
import { CalendarClock, Clock, MessageCircle, Settings, User, Wallet, ChevronRight, Circle } from "lucide-react";

import { NativeDashTile, NativeStat } from "@/components/native/NativeDashTile";
import { DashboardSheet } from "@/components/native/DashboardSheet";

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.447a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.447a1 1 0 00-1.176 0l-3.366 2.447c-.784.57-1.838-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.102 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

const PanelLoading = () => (
  <div className="flex min-h-[55vh] items-center justify-center">
    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
  </div>
);

const PANELS: Record<string, { title: string; Component: ComponentType }> = {
  requests: { title: "Demandes", Component: dynamic(() => import("@/app/(protected)/host/requests/page"), { ssr: false, loading: PanelLoading }) },
  messages: { title: "Messages", Component: dynamic(() => import("@/app/(protected)/host/messages/page"), { ssr: false, loading: PanelLoading }) },
  availability: { title: "Disponibilités", Component: dynamic(() => import("@/app/(protected)/host/availability/page"), { ssr: false, loading: PanelLoading }) },
  profile: { title: "Mon profil", Component: dynamic(() => import("@/app/(protected)/host/profile/edit/page"), { ssr: false, loading: PanelLoading }) },
  wallet: { title: "Portefeuille", Component: dynamic(() => import("@/app/(protected)/host/wallet/page"), { ssr: false, loading: PanelLoading }) },
  settings: { title: "Paramètres", Component: dynamic(() => import("@/app/(protected)/host/settings/page"), { ssr: false, loading: PanelLoading }) },
};

type HostTodo = { id: string; label: string; href: string };

// Map a todo's destination href to the in-popup panel that fulfils it.
function hrefToPanel(href: string): string {
  if (href.startsWith("/host/availability")) return "availability";
  if (href.startsWith("/host/wallet")) return "wallet";
  if (href.startsWith("/host/messages")) return "messages";
  if (href.startsWith("/host/requests")) return "requests";
  return "profile"; // profile/edit (photo, sizes, bio, verification…)
}

export function HostNativeHome({
  greetingName,
  avatarSrc,
  isPublished,
  completionUiReady,
  completionPercent,
  rating,
  pendingRequests,
  unreadMessages,
  todos,
}: {
  greetingName: string | null;
  avatarSrc: string | null;
  isPublished: boolean;
  completionUiReady: boolean;
  completionPercent: number;
  rating: string | number;
  pendingRequests: number;
  unreadMessages: number;
  todos: HostTodo[];
}) {
  const [panel, setPanel] = useState<string | null>(null);
  const isCompletion = panel === "completion";
  const active = panel && !isCompletion ? PANELS[panel] : null;
  const ActiveComponent = active?.Component ?? null;
  const sheetTitle = isCompletion ? "Compléter mon profil" : active?.title ?? "";

  return (
    <div className="space-y-4 pb-2" data-testid="host-dashboard-native">
      <div className="flex items-center gap-3">
        {avatarSrc ? (
          <Image src={avatarSrc} alt={greetingName ? `Photo de profil de ${greetingName}` : "Photo de profil"} width={56} height={56} unoptimized className="h-14 w-14 rounded-full border border-slate-200 object-cover bg-white" />
        ) : (
          <div aria-hidden="true" className="h-14 w-14 rounded-full border border-slate-200 bg-white" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-slate-500">Bonjour</p>
          <p className="truncate text-2xl font-bold tracking-tight text-slate-900">{greetingName ?? ""}</p>
        </div>
        {completionUiReady ? (
          <span className="ml-auto shrink-0 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {isPublished ? "Publié" : "Non publié"}
          </span>
        ) : null}
      </div>

      {completionUiReady && completionPercent < 100 ? (
        <button
          type="button"
          onClick={() => setPanel("completion")}
          className="flex w-full items-center gap-3 rounded-2xl bg-[#7c3aed]/10 px-4 py-3 text-left active:bg-[#7c3aed]/15"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#6d28d9]">Compléter mon profil</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#7c3aed]/20">
              <div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${completionPercent}%` }} />
            </div>
          </div>
          <span className="shrink-0 text-sm font-bold text-[#6d28d9]">{completionPercent}%</span>
        </button>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <NativeStat value={rating} label="Note" icon={<StarIcon className="h-4 w-4 text-[#F5B301]" />} />
        <NativeStat value={pendingRequests} label="Demandes" />
        <NativeStat value={unreadMessages} label="Messages" />
      </div>

      <p className="pt-1 text-sm font-semibold text-slate-900">Accès rapide</p>

      <div className="grid grid-cols-2 gap-3">
        <NativeDashTile onClick={() => setPanel("requests")} label="Demandes" icon={<CalendarClock className="h-5 w-5" />} badge={pendingRequests} variant="primary" />
        <NativeDashTile onClick={() => setPanel("messages")} label="Messages" icon={<MessageCircle className="h-5 w-5" />} badge={unreadMessages} />
        <NativeDashTile onClick={() => setPanel("availability")} label="Disponibilités" icon={<Clock className="h-5 w-5" />} />
        <NativeDashTile onClick={() => setPanel("profile")} label="Mon profil" icon={<User className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NativeDashTile onClick={() => setPanel("wallet")} label="Portefeuille" icon={<Wallet className="h-5 w-5" />} variant="ghost" />
        <NativeDashTile onClick={() => setPanel("settings")} label="Paramètres" icon={<Settings className="h-5 w-5" />} variant="ghost" />
      </div>

      <DashboardSheet open={panel != null} title={sheetTitle} onClose={() => setPanel(null)}>
        {isCompletion ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#7c3aed]/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#6d28d9]">Progression</p>
                <p className="text-sm font-bold text-[#6d28d9]">{completionPercent}%</p>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#7c3aed]/20">
                <div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${completionPercent}%` }} />
              </div>
            </div>

            {todos.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Tout est complété ✓</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">À faire</p>
                {todos.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPanel(hrefToPanel(t.href))}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left active:bg-slate-50"
                  >
                    <Circle className="h-4 w-4 shrink-0 text-[#7c3aed]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{t.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : ActiveComponent ? (
          <ActiveComponent />
        ) : null}
      </DashboardSheet>
    </div>
  );
}
