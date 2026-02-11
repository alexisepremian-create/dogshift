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

  const base =
    "relative flex items-center rounded-2xl text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const activeClasses = " bg-[#F7F3EA] text-slate-900";
  const inactiveClasses = " text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  const linkLayout = collapsed ? "h-10 w-10 justify-center" : "w-full";
  const iconWrap = collapsed ? "flex items-center justify-center" : "flex min-h-[40px] items-center gap-3 px-3 py-2";

  return (
    <div className="group/item relative">
      <Link
        href={href}
        prefetch={prefetch}
        className={base + " " + linkLayout + (active ? activeClasses : inactiveClasses)}
        onClick={onNavigate}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        title={collapsed ? label : undefined}
      >
        <span className={iconWrap}>
          <span
            className={
              "shrink-0 text-slate-500 transition group-hover/item:text-slate-700 group-focus-within/item:text-slate-700" +
              (active ? " text-slate-800" : "")
            }
          >
            {icon}
          </span>

          {forceExpanded ? (
            <span className="whitespace-nowrap">{label}</span>
          ) : null}
        </span>
      </Link>

      {collapsed ? (
        <div
          className={
            "pointer-events-none absolute left-full top-1/2 z-50 ml-3 w-max -translate-y-1/2 translate-x-2 opacity-0 " +
            "transition-all duration-[180ms] ease-out " +
            "group-hover/item:translate-x-0 group-hover/item:opacity-100 " +
            "group-focus-within/item:translate-x-0 group-focus-within/item:opacity-100"
          }
          aria-hidden="true"
        >
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.25)]">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            {description ? <p className="mt-1 text-xs font-medium text-slate-500">{description}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
