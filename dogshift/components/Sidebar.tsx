"use client";

import Image from "next/image";
import Link from "next/link";

import NavItem from "@/components/NavItem";

type SidebarItem = {
  key: string;
  label: string;
  description?: string;
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
  const asideBase = "group/sidebar relative z-40 flex h-full flex-col overflow-visible border-r border-slate-200 bg-white";

  const widthClasses = forceExpanded ? "w-[240px]" : "w-20";

  return (
    <aside className={asideBase + " " + widthClasses + (className ? ` ${className}` : "")}>
      <div className={forceExpanded ? "px-4 pt-3" : "px-4 pt-3"}>
        <Link
          href={headerHref}
          aria-label="DogShift"
          className={
            "flex items-center rounded-2xl px-2 py-2 transition hover:bg-slate-50 " +
            (forceExpanded ? "gap-3" : "justify-center")
          }
          onClick={onNavigate}
        >
          <span className={
            (forceExpanded ? "h-16 w-16" : "h-14 w-14") +
            " flex shrink-0 items-center justify-center rounded-full bg-[#F7F3EA] ring-1 ring-slate-200"
          }>
            <Image
              src="/dogshift-logo.png"
              alt="DogShift"
              width={64}
              height={64}
              className={(forceExpanded ? "h-11 w-11" : "h-10 w-10") + " object-contain"}
              priority
            />
          </span>
          {forceExpanded ? (
            <span className="overflow-hidden whitespace-nowrap text-sm font-semibold tracking-tight text-slate-900">
              DogShift
            </span>
          ) : null}
        </Link>
      </div>

      <div className={forceExpanded ? "px-3 pt-6" : "px-4 pt-6"}>
        <nav aria-label={ariaLabel} className={forceExpanded ? "space-y-1" : "flex flex-col items-center gap-1"}>
          {items.map((item) => (
            <NavItem
              key={item.key}
              label={item.label}
              description={item.description}
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
            <div className={forceExpanded ? "pt-4" : "flex justify-center pt-4"}>{footer}</div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
