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

  const compactWrapper = "group/item relative h-12 w-12";
  const compactLinkBase =
    "relative flex h-12 w-12 items-center justify-center rounded-2xl transition-[background-color,box-shadow] duration-[280ms] " +
    ease +
    " focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const compactLinkState = active
    ? " bg-white text-slate-900 shadow-[0_10px_30px_-24px_rgba(2,6,23,0.25)] ring-1 ring-slate-200"
    : " bg-transparent text-slate-700 hover:bg-white hover:shadow-[0_10px_30px_-24px_rgba(2,6,23,0.22)] hover:ring-1 hover:ring-slate-200";

  const overlayMotion =
    "pointer-events-none absolute left-full top-1/2 z-[9999] ml-3 w-max -translate-y-1/2 translate-x-2 opacity-0 " +
    "transition-all duration-[300ms] " +
    ease +
    " group-hover/item:translate-x-0 group-hover/item:opacity-100 " +
    "group-focus-within/item:translate-x-0 group-focus-within/item:opacity-100";

  return (
    <div className={collapsed ? compactWrapper : "group/item relative"}>
      {collapsed ? (
        <>
          <Link
            href={href}
            prefetch={prefetch}
            aria-label={label}
            className={compactLinkBase + " " + compactLinkState}
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
                "text-slate-500 transition group-hover/item:text-slate-700 group-focus-within/item:text-slate-700" +
                (active ? " text-slate-800" : "")
              }
            >
              {icon}
            </span>
          </Link>

          <div className={overlayMotion} aria-hidden="true">
            <div className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)] backdrop-blur">
              <span className="text-slate-700" aria-hidden="true">
                {icon}
              </span>
              <p className="whitespace-nowrap text-sm font-semibold text-slate-900">{label}</p>
            </div>
          </div>
        </>
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
