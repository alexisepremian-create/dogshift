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

  const widthClasses = forceExpanded ? "w-[240px]" : "w-[84px]";

  return (
    <aside
      className={
        asideBase +
        " " +
        widthClasses +
        (className ? ` ${className}` : "") +
        (forceExpanded ? "" : " items-center py-4")
      }
    >
      <div className={forceExpanded ? "w-full px-4 pt-3" : "flex h-[84px] w-full items-center justify-center"}>
        <Link
          href={headerHref}
          aria-label="DogShift"
          className={
            (forceExpanded
              ? "flex w-full items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-slate-50"
              : "flex items-center justify-center")
          }
          onClick={onNavigate}
        >
          <span
            className={
              (forceExpanded ? "h-16 w-16" : "h-14 w-14") +
              " flex shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200"
            }
          >
            <Image
              src="/dogshift-logo.png"
              alt="DogShift"
              width={64}
              height={64}
              className={(forceExpanded ? "h-11 w-11" : "h-11 w-11") + " object-contain"}
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

      <div className={forceExpanded ? "w-full px-3 pt-6" : "flex w-full flex-1 items-center justify-center"}>
        <nav
          aria-label={ariaLabel}
          className={
            forceExpanded
              ? "w-full space-y-1"
              : "flex flex-col items-center justify-center gap-4"
          }
        >
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
      </div>

      {footer ? (
        <div
          className={
            forceExpanded
              ? "w-full px-3 pb-4 pt-4"
              : "flex h-[84px] w-full items-center justify-center border-t border-slate-200"
          }
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
