"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bot, CalendarDays, FileText, GitMerge, GripVertical, LayoutDashboard, LogOut, Mail, MailOpen, ReceiptText, Scale, ScrollText, Settings, ShieldAlert, ShieldCheck, ShieldPlus, Users, Wrench } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

const NAV_ORDER_KEY = "admin_nav_order_v1";

const DEFAULT_NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/sitters/applications", label: "Candidatures", icon: Users },
  { href: "/admin/sitters/active", label: "Dogsitters actifs", icon: Users },
  { href: "/admin/verifications", label: "Vérifications", icon: ShieldCheck },
  { href: "/admin/avenants", label: "Avenants", icon: ScrollText },
  { href: "/admin/couts-abonnements", label: "Coûts & abonnements", icon: ReceiptText },
  { href: "/admin/finance", label: "Finance", icon: ReceiptText },
  { href: "/admin/owners", label: "Propriétaires", icon: FileText },
  { href: "/admin/agents", label: "Agents", icon: Bot },
  { href: "/admin/bookings", label: "Réservations", icon: CalendarDays },
  { href: "/admin/incidents", label: "Signalements", icon: ShieldAlert },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/securite", label: "Sécurité du site", icon: ShieldPlus },
  { href: "/admin/juridique", label: "Journal juridique", icon: Scale },
  { href: "/admin/communications", label: "Communications", icon: Mail },
  { href: "/admin/emails", label: "Aperçu emails", icon: MailOpen },
  { href: "/admin/maintenance", label: "Santé technique", icon: Wrench },
  { href: "/admin/changelog", label: "Changelog", icon: GitMerge },
];

function loadOrder(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

function saveOrder(hrefs: string[]) {
  try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(hrefs)); } catch { /* noop */ }
}

function buildNavFromOrder(savedOrder: string[] | null) {
  if (!savedOrder) return [...DEFAULT_NAV];
  const map = new Map(DEFAULT_NAV.map((item) => [item.href, item]));
  // Start with saved order (filtering out stale hrefs), then append any new items
  const ordered = savedOrder.map((h) => map.get(h)).filter(Boolean) as typeof DEFAULT_NAV;
  const missing = DEFAULT_NAV.filter((item) => !savedOrder.includes(item.href));
  return [...ordered, ...missing];
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [navItems, setNavItems] = useState(() => buildNavFromOrder(loadOrder()));
  const dragIndexRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Persist on every change
  useEffect(() => {
    saveOrder(navItems.map((item) => item.href));
  }, [navItems]);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOver(index);
  }, []);

  const handleDrop = useCallback((targetIndex: number) => {
    const from = dragIndexRef.current;
    if (from === null || from === targetIndex) { setDragOver(null); return; }
    setNavItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
    setDragOver(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOver(null);
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:block lg:px-5 lg:py-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">DogShift Admin</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Panel interne</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 lg:mt-6"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{loggingOut ? "Déconnexion…" : "Quitter"}</span>
            </button>
          </div>

          <nav className="grid gap-1 px-3 pb-4 sm:px-5 lg:pb-6">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const hrefPath = item.href.split("?")[0] || item.href;
              const active = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
              const isOver = dragOver === index;
              return (
                <div
                  key={item.href}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`group relative transition-transform ${isOver ? "scale-[1.02] opacity-70" : ""}`}
                >
                  {/* Drop indicator */}
                  {isOver && (
                    <div className="pointer-events-none absolute -top-0.5 left-3 right-3 h-0.5 rounded-full bg-[var(--dogshift-blue)]" />
                  )}
                  <Link
                    href={item.href}
                    className={
                      "inline-flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition " +
                      (active
                        ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_88%)] text-[var(--dogshift-blue)]"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900")
                    }
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {/* Drag handle — visible on hover */}
                    <GripVertical className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-slate-300 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing" />
                  </Link>
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Administration interne</p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Pilotage de la plateforme</h1>
              </div>
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 sm:inline-flex">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                <span>Accès sécurisé</span>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
