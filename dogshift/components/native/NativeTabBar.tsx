"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import type { BottomNavItem } from "@/components/MobileBottomNav";

/**
 * Native app bottom tab bar — a solid, edge-to-edge bar anchored to the bottom
 * (NOT the floating pill used on web). Layout mirrors the founder's reference:
 *
 *   [ tab ] [ tab ]  ( DogShift logo )  [ tab ] [ tab ]
 *
 * The raised purple DogShift logo in the middle opens the "more" sheet (all the
 * other sections — what the old "•••" did). The flanking tabs are the primary
 * destinations, incl. a person icon → dashboard.
 */
const NAV_HEIGHT_VAR = "--ds-bottom-nav-h";

function syncNavHeight(px: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(NAV_HEIGHT_VAR, `${px}px`);
}

function Tab({ item, onNavigate }: { item: BottomNavItem; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={item.active ? "page" : undefined}
      aria-label={item.label}
      className="flex flex-1 flex-col items-center justify-center gap-1 py-1.5 select-none"
    >
      <span style={{ color: item.active ? "#7c3aed" : "#94a3b8" }}>{item.icon}</span>
      <span
        className="max-w-full truncate text-[10px] font-semibold leading-none"
        style={{ color: item.active ? "#7c3aed" : "#94a3b8" }}
      >
        {item.label}
      </span>
    </Link>
  );
}

export default function NativeTabBar({ items, moreItems = [] }: { items: BottomNavItem[]; moreItems?: BottomNavItem[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => {
      const safeArea = parseFloat(getComputedStyle(navRef.current ?? document.body).paddingBottom || "0");
      syncNavHeight(el.offsetHeight + safeArea);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      syncNavHeight(0);
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (navRef.current?.contains(e.target as Node)) return;
      setMoreOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [moreOpen]);

  return (
    <nav
      ref={navRef}
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* ── "More" sheet (opened by the center logo) ── */}
      {moreOpen && moreItems.length > 0 ? (
        <div className="mx-2 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_-8px_30px_rgba(2,6,23,0.14)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="text-[13px] font-semibold text-slate-700">Menu</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex max-h-[50vh] flex-col overflow-y-auto py-1">
            {moreItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={
                  "flex items-center gap-3 px-5 py-3 text-sm transition " +
                  (item.active ? "bg-slate-900/5 font-semibold text-slate-900" : "font-medium text-slate-600 active:bg-slate-50")
                }
              >
                <span className={item.active ? "text-slate-900" : "text-slate-400"}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Solid bar ── */}
      <div ref={barRef} className="border-t border-slate-200 bg-white">
        <div className="relative flex h-[58px] items-stretch">
          {left.map((item) => (
            <Tab key={item.key} item={item} onNavigate={() => setMoreOpen(false)} />
          ))}

          {/* Center DogShift logo → opens the more sheet */}
          <div className="flex w-[72px] shrink-0 items-start justify-center">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={moreOpen}
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#7c3aed] shadow-[0_10px_24px_-6px_rgba(124,58,237,0.6)] ring-4 ring-white active:scale-95"
            >
              <Image src="/dogshift-paw-white.png" alt="DogShift" width={30} height={30} className="h-7 w-7 object-contain" />
            </button>
          </div>

          {right.map((item) => (
            <Tab key={item.key} item={item} onNavigate={() => setMoreOpen(false)} />
          ))}
        </div>
      </div>
    </nav>
  );
}
