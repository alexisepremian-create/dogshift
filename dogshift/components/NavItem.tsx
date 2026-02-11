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

  const ease = "ease-[cubic-bezier(0.4,0,0.2,1)]";

  const expandedBase =
    "relative flex w-full items-center rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const expandedActive = " bg-slate-50 text-slate-900";
  const expandedInactive = " text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  const compactWrapper = "group relative h-12 w-12";

  const compactLinkBase =
    "absolute left-0 top-0 z-[9999] flex h-12 items-center overflow-hidden rounded-full bg-transparent " +
    "transition-[width,background-color,border-radius] duration-[350ms] " +
    ease +
    " focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const compactLinkSizing = "w-12 group-hover:w-[160px] group-focus-visible:w-[160px]";

  const compactLinkHover =
    "group-hover:bg-[#0F172A] group-hover:rounded-[24px] " +
    "group-focus-visible:bg-[#0F172A] group-focus-visible:rounded-[24px]";

  const iconCircle =
    "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full box-border" +
    (active ? " ring-2 ring-slate-900/40 ring-inset" : "");

  const labelMotion =
    "whitespace-nowrap text-sm font-semibold text-white opacity-0 translate-x-[-4px] " +
    "transition-[opacity,transform] duration-[350ms] " +
    ease +
    " group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0";

  return (
    <div className={collapsed ? compactWrapper : "group/item relative"}>
      {collapsed ? (
        <Link
          href={href}
          prefetch={prefetch}
          aria-label={label}
          className={compactLinkBase + " " + compactLinkSizing + " " + compactLinkHover}
          onClick={(e) => {
            (e.currentTarget as HTMLAnchorElement).blur();
            onNavigate?.();
          }}
          onMouseEnter={onMouseEnter}
          onFocus={onFocus}
          title={label}
        >
          <span className={iconCircle}>
            <span className="text-slate-700 transition group-hover:text-white group-focus-visible:text-white">
              {icon}
            </span>
          </span>

          <span className={"pr-4 " + labelMotion}>{label}</span>
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
