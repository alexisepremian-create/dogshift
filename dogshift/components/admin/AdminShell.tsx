"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarDays, FileText, LayoutDashboard, LogOut, Settings, ShieldAlert, Users } from "lucide-react";
import { type ReactNode, useState } from "react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/sitters", label: "Dogsitters", icon: Users },
  { href: "/admin/owners", label: "Propriétaires", icon: FileText },
  { href: "/admin/bookings", label: "Réservations", icon: CalendarDays },
  { href: "/admin/incidents", label: "Signalements", icon: ShieldAlert },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col lg:flex-row">
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
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition " +
                    (active
                      ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_88%)] text-[var(--dogshift-blue)]"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900")
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
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
