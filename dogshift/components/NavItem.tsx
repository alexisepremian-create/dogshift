"use client";

import Link from "next/link";

type NavItemProps = {
  label: string;
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
  href,
  icon,
  active,
  onNavigate,
  prefetch,
  forceExpanded,
  onMouseEnter,
  onFocus,
}: NavItemProps) {
  const base =
    "group/item relative flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dogshift-blue)]";

  const activeClasses = " bg-slate-50 text-slate-900";
  const inactiveClasses = " text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  const labelClasses = forceExpanded
    ? "max-w-[160px] opacity-100"
    : "max-w-0 opacity-0 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100";

  return (
    <div className="relative">
      {active ? (
        <div className="pointer-events-none absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-[var(--dogshift-blue)]" />
      ) : null}

      <Link
        href={href}
        prefetch={prefetch}
        className={base + (active ? activeClasses : inactiveClasses)}
        onClick={onNavigate}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        title={!forceExpanded ? label : undefined}
      >
        <span className={"shrink-0 text-slate-500 transition group-hover/item:text-slate-700" + (active ? " text-slate-700" : "")}>{icon}</span>
        <span
          className={
            "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[250ms] ease-in-out " +
            labelClasses
          }
        >
          {label}
        </span>
      </Link>
    </div>
  );
}
