"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

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
      className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 py-1.5 select-none"
    >
      <span style={{ color: item.active ? "#ffffff" : "#94a3b8", transition: "color 200ms ease" }}>{item.icon}</span>
      <span
        // Smaller + tighter so the longest label ("Réservations") fits on one
        // line without being clipped, even on a 375px-wide screen.
        className="max-w-full truncate px-0.5 text-[10px] font-semibold leading-none tracking-tight"
        style={{ color: item.active ? "#ffffff" : "#94a3b8", transition: "color 200ms ease" }}
      >
        {item.label}
      </span>
    </Link>
  );
}

export default function NativeTabBar({ items }: { items: BottomNavItem[] }) {
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const half = Math.ceil(items.length / 2);
  const left = items.slice(0, half);
  const right = items.slice(half);

  // Sliding purple pill behind the active tab. The center logo occupies a fixed
  // 80px slot between the left and right groups, so right-group tabs are shifted
  // by +80px. Each tab is `(100% - 80px) / count` wide.
  const CENTER = 80;
  const activeIndex = items.findIndex((i) => i.active);
  const tabExpr = `((100% - ${CENTER}px) / ${items.length})`;
  const pillWidth = `calc(${tabExpr} - 12px)`;
  const pillLeft = `calc(${tabExpr} * ${activeIndex} ${activeIndex >= half ? `+ ${CENTER}px ` : ""}+ 6px)`;

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
    // Re-measure once fonts/safe-area settle.
    const t = setTimeout(measure, 300);
    return () => {
      ro?.disconnect();
      clearTimeout(t);
      syncNavHeight(0);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
    >
      {/* ── Solid bar — white fills through the safe area so nothing shows below ── */}
      <div
        ref={barRef}
        className="border-t border-slate-200 bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="relative flex h-[58px] items-stretch">
          {/* Sliding purple pill behind the active tab */}
          {activeIndex >= 0 ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-[8px] z-0 rounded-2xl bg-[#7c3aed]"
              style={{
                left: pillLeft,
                width: pillWidth,
                transition: "left 320ms cubic-bezier(0.34, 1.15, 0.64, 1)",
              }}
            />
          ) : null}

          {left.map((item) => (
            <Tab key={item.key} item={item} onNavigate={() => undefined} />
          ))}

          {/* Center DogShift logo → opens the breeding "Rencontres" feature */}
          <div className="flex w-[80px] shrink-0 items-start justify-center">
            <button
              type="button"
              onClick={() => router.push("/breeding")}
              aria-label="Rencontres"
              className="-mt-7 h-[68px] w-[68px] overflow-hidden rounded-full bg-[#7c3aed] shadow-[0_12px_28px_-6px_rgba(124,58,237,0.65)] active:scale-95"
            >
              <Image src="/apple-touch-icon.png" alt="Rencontres" width={68} height={68} className="h-full w-full object-cover" priority />
            </button>
          </div>

          {right.map((item) => (
            <Tab key={item.key} item={item} onNavigate={() => undefined} />
          ))}
        </div>
      </div>
    </nav>
  );
}
