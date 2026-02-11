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

  const compactWrapper = "relative h-[52px] w-[52px]";

  const iconButtonBase =
    "relative grid h-[52px] w-[52px] place-items-center rounded-full bg-transparent transition-colors duration-200";

  const iconButtonState =
    "group-hover:bg-slate-100 group-focus-visible:bg-slate-100" +
    (active ? " ring-2 ring-slate-900/40 ring-inset" : "");

  const pillMotion =
    "pointer-events-none absolute left-[60px] top-1/2 z-[9999] -translate-y-1/2 " +
    "flex h-[52px] items-center rounded-2xl bg-[#0F172A] px-4 text-sm font-semibold text-white " +
    "opacity-0 scale-95 transition-[opacity,transform] duration-[320ms] " +
    ease +
    " group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100";

  return (
    <div className={collapsed ? compactWrapper : "group/item relative"}>
      {collapsed ? (
        <Link
          href={href}
          prefetch={prefetch}
          aria-label={label}
          className="group relative flex items-center justify-center"
          onClick={(e) => {
            (e.currentTarget as HTMLAnchorElement).blur();
            onNavigate?.();
          }}
          onMouseEnter={onMouseEnter}
          onFocus={onFocus}
          title={label}
        >
          <span className={iconButtonBase + " " + iconButtonState}>
            <span className={"text-slate-700 transition group-hover:text-slate-900 group-focus-visible:text-slate-900" + (active ? " text-slate-900" : "")}>
              {icon}
            </span>
          </span>

          <span className={pillMotion}>{label}</span>
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
