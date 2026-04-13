"use client";

import Link from "next/link";

export type BottomNavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
};

type MobileBottomNavProps = {
  items: BottomNavItem[];
};

export default function MobileBottomNav({ items }: MobileBottomNavProps) {
  const activeIndex = Math.max(0, items.findIndex((i) => i.active));
  const count = items.length;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Floating pill bar */}
      <div className="mx-3 mb-3 overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-[0_-2px_20px_rgba(2,6,23,0.07),0_8px_32px_-8px_rgba(2,6,23,0.10)]">
        <div className="relative flex h-[60px]">

          {/* ── Sliding background pill ── */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-[5px] rounded-[22px] bg-slate-900"
            style={{
              width: `calc(${100 / count}% - 6px)`,
              left: `calc(${(100 / count) * activeIndex}% + 3px)`,
              transition:
                "left 320ms cubic-bezier(0.34, 1.15, 0.64, 1), width 320ms cubic-bezier(0.34, 1.15, 0.64, 1)",
            }}
          />

          {/* ── Tabs ── */}
          {items.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <Link
                key={item.key}
                href={item.href}
                className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-hidden select-none focus-visible:outline-none"
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
              >
                {/* Icon */}
                <span
                  style={{
                    color: isActive ? "#ffffff" : "#94a3b8",
                    transition: "color 200ms ease",
                  }}
                >
                  {item.icon}
                </span>

                {/* Label — visible only for active tab */}
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
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
