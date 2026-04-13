"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, X } from "lucide-react";

export type BottomNavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
};

type MobileBottomNavProps = {
  items: BottomNavItem[];
  moreItems?: BottomNavItem[];
};

const NAV_HEIGHT_VAR = "--ds-bottom-nav-h";

function syncNavHeight(px: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(NAV_HEIGHT_VAR, `${px}px`);
}

export default function MobileBottomNav({ items, moreItems = [] }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const hasMore = moreItems.length > 0;
  const moreIsActive = moreItems.some((i) => i.active);

  const allTabs = hasMore
    ? [...items, { key: "__more", label: "Plus", href: "#", icon: <MoreHorizontal className="h-5 w-5" />, active: moreIsActive }]
    : items;

  const activeIndex = Math.max(0, allTabs.findIndex((i) => i.active));
  const count = allTabs.length;

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => syncNavHeight(el.offsetHeight);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); syncNavHeight(0); };
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
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* ── "More" overlay sheet ── */}
      {moreOpen && hasMore && (
        <div className="mx-3 mb-2 overflow-hidden rounded-[22px] border border-white/20 bg-white/80 shadow-[0_-4px_30px_rgba(2,6,23,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-100/60 px-5 py-3">
            <span className="text-[13px] font-semibold text-slate-700">Plus</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col py-1">
            {moreItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={[
                  "flex items-center gap-3 px-5 py-3 text-sm transition",
                  item.active
                    ? "bg-slate-900/5 font-semibold text-slate-900"
                    : "font-medium text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                <span className={item.active ? "text-slate-900" : "text-slate-400"}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Frosted glass bar ── */}
      <div className="mx-3 mb-3 overflow-hidden rounded-[28px] border border-white/30 bg-white/70 shadow-[0_-2px_24px_rgba(2,6,23,0.08),0_8px_32px_-8px_rgba(2,6,23,0.12)] backdrop-blur-xl">
        <div className="relative flex h-[60px]">

          {/* ── Sliding background pill ── */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-[5px] rounded-[22px] bg-slate-900/90 backdrop-blur-sm"
            style={{
              width: `calc(${100 / count}% - 6px)`,
              left: `calc(${(100 / count) * activeIndex}% + 3px)`,
              transition:
                "left 320ms cubic-bezier(0.34, 1.15, 0.64, 1), width 320ms cubic-bezier(0.34, 1.15, 0.64, 1)",
            }}
          />

          {/* ── Tabs ── */}
          {allTabs.map((item, idx) => {
            const isActive = idx === activeIndex;
            const isMore = item.key === "__more";

            const inner = (
              <>
                <span
                  style={{
                    color: isActive ? "#ffffff" : "#64748b",
                    transition: "color 200ms ease",
                  }}
                >
                  {item.icon}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    display: "block",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    maxWidth: "90%",
                    fontSize: "9.5px",
                    fontWeight: 600,
                    lineHeight: 1,
                    letterSpacing: "0.01em",
                    color: "#ffffff",
                    maxHeight: isActive ? "14px" : "0px",
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? "translateY(0)" : "translateY(-4px)",
                    transition:
                      "max-height 250ms ease-out, opacity 200ms ease-out, transform 250ms ease-out",
                    marginTop: isActive ? "3px" : "0px",
                  }}
                >
                  {item.label}
                </span>
              </>
            );

            if (isMore) {
              return (
                <button
                  key="__more"
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-hidden select-none focus-visible:outline-none"
                  aria-label="Plus de sections"
                  aria-expanded={moreOpen}
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-hidden select-none focus-visible:outline-none"
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
