import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "default" | "ghost";

/**
 * Big, tappable action tile for the native (Capacitor) dashboards.
 * Minimalist: an icon chip, a short label, an optional count badge. Primary
 * variant = filled purple CTA. Used by both the owner and sitter native homes.
 *
 * Pass `href` to navigate (`<Link>`) or `onClick` to open a popup sheet
 * (`<button>`).
 */
export function NativeDashTile({
  href,
  onClick,
  label,
  icon,
  badge,
  variant = "default",
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  icon: ReactNode;
  badge?: number;
  variant?: Variant;
}) {
  const shell =
    variant === "primary"
      ? "bg-[#7c3aed] text-white shadow-[0_12px_30px_-14px_rgba(124,58,237,0.7)] active:bg-[#6d28d9]"
      : variant === "ghost"
        ? "bg-slate-50 text-slate-700 active:bg-slate-100"
        : "border border-slate-200 bg-white text-slate-900 active:bg-slate-50";

  const chip =
    variant === "primary"
      ? "bg-white/20 text-white"
      : "bg-[#7c3aed]/10 text-[#7c3aed]";

  const className =
    "relative flex min-h-[92px] flex-col items-start justify-between gap-5 rounded-2xl p-4 text-left transition active:scale-[0.98] " +
    shell;

  const inner = (
    <>
      <span className={"inline-flex h-9 w-9 items-center justify-center rounded-xl " + chip}>{icon}</span>
      <span className="text-sm font-semibold leading-tight">{label}</span>
      {typeof badge === "number" && badge > 0 ? (
        <span className="absolute right-3 top-3 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href ?? "#"} className={className}>
      {inner}
    </Link>
  );
}

/** Compact key-figure chip (one number + label) for the native dashboards. */
export function NativeStat({ value, label, icon }: { value: ReactNode; label: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-lg font-bold text-slate-900">
        {icon}
        {value}
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  );
}
