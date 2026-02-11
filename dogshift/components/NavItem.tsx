"use client";

import Link from "next/link";

type NavItemProps = {
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
  active: boolean;
  onNavigate?: () => void;
  prefetch?: boolean;
  forceExpanded?: boolean;
  onMouseEnter?: () => void;
  onFocus?: () => void;
};

export default function NavItem({
  label,
  description,
  href,
  icon,
  active,
  onNavigate,
  prefetch,
  forceExpanded,
  onMouseEnter,
  onFocus,
}: NavItemProps) {
  const collapsed = !forceExpanded;

  const ease = "ease-[cubic-bezier(0.175,0.885,0.32,1.275)]";

  const expandedBase =
    "relative flex w-full items-center rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const expandedActive = " bg-[#F7F3EA] text-slate-900";
  const expandedInactive = " text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  const compactWrapper = "relative h-12 w-12";
  const compactLinkBase =
    "absolute left-0 top-0 flex h-12 items-center overflow-hidden rounded-[20px] border border-transparent text-sm font-semibold transition-[width,background-color,border-color,box-shadow] duration-[200ms] " +
    ease +
    " focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const compactLinkState = active
    ? " bg-[#F7F3EA] text-slate-900"
    : " bg-transparent text-slate-700 hover:bg-white";

  const compactLinkSizing = " w-12 group-hover/item:w-[180px] group-focus-within/item:w-[180px]";
  const compactShadow = " group-hover/item:shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)] group-focus-within/item:shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)]";
  const compactBorder = " group-hover/item:border-slate-200 group-focus-within/item:border-slate-200";

  const labelMotion =
    "whitespace-nowrap opacity-0 transition-all duration-[180ms] " +
    ease +
    " group-hover/item:translate-x-0 group-hover/item:opacity-100 group-focus-within/item:translate-x-0 group-focus-within/item:opacity-100";

  return (
    <div className={"group/item " + (collapsed ? compactWrapper : "relative")}
      style={collapsed ? undefined : undefined}
    >
      {collapsed ? (
        <Link
          href={href}
          prefetch={prefetch}
          className={
            compactLinkBase +
            compactLinkSizing +
            compactLinkState +
            compactBorder +
            compactShadow +
            " z-[9999]"
          }
          onClick={onNavigate}
          onMouseEnter={onMouseEnter}
          onFocus={onFocus}
          title={label}
        >
          <span className="flex h-12 w-12 items-center justify-center">
            <span className={"text-slate-500 transition group-hover/item:text-slate-700 group-focus-within/item:text-slate-700" + (active ? " text-slate-800" : "")}>
              {icon}
            </span>
          </span>
          <span className={"-ml-1 translate-x-[-4px] pr-4 " + labelMotion}>{label}</span>
        </Link>
      ) : (
        <Link
          href={href}
          prefetch={prefetch}
          className={expandedBase + (active ? expandedActive : expandedInactive)}
          onClick={onNavigate}
          onMouseEnter={onMouseEnter}
          onFocus={onFocus}
        >
          <span className={"shrink-0 text-slate-500 transition group-hover/item:text-slate-700 group-focus-within/item:text-slate-700" + (active ? " text-slate-800" : "")}>{icon}</span>
          <span className="ml-3 whitespace-nowrap">{label}</span>
        </Link>
      )}
    </div>
  );
}
