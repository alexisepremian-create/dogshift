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

  const expandedActive = " bg-slate-50 text-slate-900";
  const expandedInactive = " text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  const compactWrapper = "group/item relative h-[52px] w-[52px]";

  const compactLinkBase =
    "absolute left-0 top-0 z-[9999] flex h-[52px] items-center overflow-hidden rounded-[22px] transition-[width,background-color,box-shadow] duration-[300ms] " +
    ease +
    " focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const compactLinkSizing = " w-[52px] group-hover/item:w-[184px] group-focus-within/item:w-[184px]";

  const compactLinkState =
    "bg-transparent text-slate-700 " +
    "hover:bg-[#111827] hover:text-white hover:shadow-[0_18px_60px_-46px_rgba(2,6,23,0.35)] " +
    "focus-visible:bg-[#111827] focus-visible:text-white focus-visible:shadow-[0_18px_60px_-46px_rgba(2,6,23,0.35)]" +
    (active ? "" : "");

  const compactActiveCircle =
    "before:content-[''] before:absolute before:inset-0 before:rounded-full before:pointer-events-none " +
    "before:shadow-[0_0_0_2px_rgba(15,23,42,0.18)]";

  const labelMotion =
    "whitespace-nowrap opacity-0 transition-all duration-[220ms] " +
    ease +
    " group-hover/item:translate-x-0 group-hover/item:opacity-100 group-focus-within/item:translate-x-0 group-focus-within/item:opacity-100";

  return (
    <div className={collapsed ? compactWrapper : "group/item relative"}>
      {collapsed ? (
        <Link
          href={href}
          prefetch={prefetch}
          aria-label={label}
          className={compactLinkBase + compactLinkSizing + " " + compactLinkState}
          onClick={(e) => {
            (e.currentTarget as HTMLAnchorElement).blur();
            onNavigate?.();
          }}
          onMouseEnter={onMouseEnter}
          onFocus={onFocus}
          title={label}
        >
          <span
            className={
              "relative flex h-[52px] w-[52px] items-center justify-center rounded-full " +
              (active ? compactActiveCircle : "")
            }
          >
            <span
              className={
                "text-slate-600 transition " +
                "group-hover/item:text-white group-focus-within/item:text-white " +
                (active ? " text-[var(--dogshift-blue)] group-hover/item:text-white group-focus-within/item:text-white" : "")
              }
            >
              {icon}
            </span>
          </span>
          <span className={"-ml-1 translate-x-[-4px] pr-5 text-sm font-semibold text-white " + labelMotion}>{label}</span>
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
