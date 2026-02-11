"use client";

import Image from "next/image";
import Link from "next/link";

import NavItem from "@/components/NavItem";

type SidebarItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
  prefetch?: boolean;
  onMouseEnter?: () => void;
  onFocus?: () => void;
};

type SidebarProps = {
  ariaLabel: string;
  items: SidebarItem[];
  footer?: React.ReactNode;
  onNavigate?: () => void;
  className?: string;
  forceExpanded?: boolean;
  headerHref?: string;
};

export default function Sidebar({ ariaLabel, items, footer, onNavigate, className, forceExpanded, headerHref = "/" }: SidebarProps) {
  const asideBase = "group/sidebar flex h-full flex-col border-r border-slate-200 bg-white";

  const widthClasses = forceExpanded
    ? "w-[240px]"
    : "w-[72px] transition-[width] duration-[250ms] ease-in-out hover:w-[240px]";

  const brandTextClasses = forceExpanded
    ? "max-w-[160px] opacity-100"
    : "max-w-0 opacity-0 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100";

  return (
    <aside className={asideBase + " " + widthClasses + (className ? ` ${className}` : "")}>
      <div className="px-4 pt-2.5">
        <Link
          href={headerHref}
          aria-label="DogShift"
          className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-slate-50"
          onClick={onNavigate}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F7F3EA] ring-1 ring-slate-200">
            <Image src="/dogshift-logo.png" alt="DogShift" width={64} height={64} className="h-6 w-auto" priority />
          </span>
          <span
            className={
              "overflow-hidden whitespace-nowrap text-sm font-semibold tracking-tight text-slate-900 transition-[max-width,opacity] duration-[250ms] ease-in-out " +
              brandTextClasses
            }
          >
            DogShift
          </span>
        </Link>
      </div>

      <div className="px-3 pt-6">
        <nav aria-label={ariaLabel} className="space-y-1">
          {items.map((item) => (
            <NavItem
              key={item.key}
              label={item.label}
              href={item.href}
              icon={item.icon}
              active={item.active}
              onNavigate={onNavigate}
              prefetch={item.prefetch}
              forceExpanded={forceExpanded}
              onMouseEnter={item.onMouseEnter}
              onFocus={item.onFocus}
            />
          ))}
        </nav>

        {footer ? (
          <>
            <div className="mt-6 border-t border-slate-200" />
            <div className="pt-4">{footer}</div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
