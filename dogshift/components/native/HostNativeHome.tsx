"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useRef, useState, type ComponentType } from "react";
import { CalendarClock, Clock, MessageCircle, Settings, User, Wallet, ChevronRight, Circle, Camera } from "lucide-react";

import { NativeDashTile, NativeStat } from "@/components/native/NativeDashTile";
import { DashboardSheet } from "@/components/native/DashboardSheet";

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.447a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.447a1 1 0 00-1.176 0l-3.366 2.447c-.784.57-1.838-.197-1.54-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.102 9.384c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

// The dynamic() import uses `loading: () => null` (NOT its own spinner) on
// purpose: the destination page renders the ONE-AND-ONLY loading spinner (its
// `inSheet` branch). If dynamic() rendered a spinner too, tapping a tile would
// paint dynamic's spinner, then swap to the page's spinner — two different DOM
// nodes, so the CSS rotation restarts at 0° on the swap ("s'arrête et
// continue"). One spinner node, mounted once, rotates continuously instead.
const nullLoading = () => null;

// Lazy import factories — each destination chunk is loaded on demand when its
// tile is tapped (with the panel's own single spinner while it loads). We do NOT
// prefetch them at launch: warming all 6 heavy chunks (availability alone is
// ~3000 lines) right after the dashboard mounts saturated the network + blocked
// the main thread parsing them, which made the app launch — and the avatar
// image — noticeably slower (founder). On-tap load keeps launch light.
const PANEL_IMPORTERS = {
  requests: () => import("@/app/(protected)/host/requests/page"),
  // The conversation list + "Nouvelle conversation" (+) FAB live in the messages
  // *layout*, not the page (which is just the empty detail placeholder). Render
  // the layout so the panel shows the real conversations section with the +.
  messages: () => import("@/app/(protected)/host/messages/layout"),
  availability: () => import("@/app/(protected)/host/availability/page"),
  profile: () => import("@/app/(protected)/host/profile/edit/page"),
  wallet: () => import("@/app/(protected)/host/wallet/page"),
  settings: () => import("@/app/(protected)/host/settings/page"),
} as const;

const PANELS: Record<string, { title: string; Component: ComponentType }> = {
  requests: { title: "Demandes", Component: dynamic(PANEL_IMPORTERS.requests, { ssr: false, loading: nullLoading }) },
  messages: { title: "Messages", Component: dynamic(PANEL_IMPORTERS.messages, { ssr: false, loading: nullLoading }) },
  availability: { title: "Disponibilités", Component: dynamic(PANEL_IMPORTERS.availability, { ssr: false, loading: nullLoading }) },
  profile: { title: "Mon profil", Component: dynamic(PANEL_IMPORTERS.profile, { ssr: false, loading: nullLoading }) },
  wallet: { title: "Portefeuille", Component: dynamic(PANEL_IMPORTERS.wallet, { ssr: false, loading: nullLoading }) },
  settings: { title: "Paramètres", Component: dynamic(PANEL_IMPORTERS.settings, { ssr: false, loading: nullLoading }) },
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
  onAvatarChange,
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
  onAvatarChange?: (url: string) => void;
  todos: HostTodo[];
}) {
  const [panel, setPanel] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(avatarSrc);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isCompletion = panel === "completion";

  async function uploadAvatar(file: File) {
    setAvatarUploading(true);
    try {
      const rawType = (file.type || "").toLowerCase();
      const contentType = rawType === "image/png" ? "image/png" : rawType === "image/webp" ? "image/webp" : "image/jpeg";
      const presRes = await fetch("/api/host/profile/avatar/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, sizeBytes: file.size }),
      });
      const pres = (await presRes.json().catch(() => null)) as { ok?: boolean; uploadUrl?: string; key?: string } | null;
      if (!presRes.ok || !pres?.ok || !pres.uploadUrl || !pres.key) return;
      const putRes = await fetch(String(pres.uploadUrl), { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!putRes.ok) return;
      const commitRes = await fetch("/api/host/profile/avatar/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: pres.key }),
      });
      const commit = (await commitRes.json().catch(() => null)) as { ok?: boolean; avatarUrl?: string } | null;
      if (!commitRes.ok || !commit?.ok || typeof commit.avatarUrl !== "string") return;
      setAvatar(commit.avatarUrl);
      // Tell the parent so the completion % + to-do list recompute immediately
      // (the photo check flips to done without waiting for a reload).
      onAvatarChange?.(commit.avatarUrl);
    } finally {
      setAvatarUploading(false);
    }
  }
  const active = panel && !isCompletion ? PANELS[panel] : null;
  const ActiveComponent = active?.Component ?? null;
  const sheetTitle = isCompletion ? "Compléter mon profil" : active?.title ?? "";

  return (
    <div className="space-y-4 pb-2" data-testid="host-dashboard-native">
      <div className="flex items-center gap-3">
        {/* The <input> overlays the avatar (opacity-0) instead of being hidden,
            so iOS anchors its photo picker popover to the avatar — not the
            centre of the screen when triggered from the "Ajouter une photo"
            checklist item. */}
        <div className="relative h-14 w-14 shrink-0">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-white">
            {avatar ? (
              <Image src={avatar} alt={greetingName ? `Photo de profil de ${greetingName}` : "Photo de profil"} fill unoptimized className="object-cover" sizes="56px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Camera className="h-5 w-5 text-[#7c3aed]" aria-hidden="true" />
              </span>
            )}
            {avatarUploading ? (
              <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" />
              </span>
            ) : null}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            aria-label="Changer la photo de profil"
            className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.currentTarget.value = "";
            }}
          />
        </div>
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
                    onClick={() => {
                      // The photo can only be changed from the dashboard avatar.
                      // iOS anchors the file picker to the tap location, so we
                      // can't open it from here without it landing mid-screen —
                      // instead close the sheet so the avatar (with its camera
                      // badge) is right there to tap.
                      if (t.id === "avatar") {
                        setPanel(null);
                        return;
                      }
                      setPanel(hrefToPanel(t.href));
                    }}
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
