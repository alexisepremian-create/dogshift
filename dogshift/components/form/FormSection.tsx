import type { ReactNode } from "react";

type Props = {
  /**
   * Small icon rendered inside a tinted bubble on the left of the title.
   * Accepts any lucide-react icon (or any JSX) so we can stay on the
   * project's existing icon set without adding new deps.
   */
  icon?: ReactNode;
  /**
   * Small uppercase kicker above the title. Optional — used on the first
   * section of a step to reinforce the group without shouting.
   */
  kicker?: string;
  /** Main heading of the section. */
  title: string;
  /**
   * Optional one-liner below the title that explains the intent of the
   * group. Kept deliberately subtle (slate-500) to stay out of the way.
   */
  description?: ReactNode;
  /**
   * When `true`, renders the section with a very soft slate background
   * instead of pure white. Used for the final "Consentements" section so
   * it stands out as administrative without breaking the flow.
   */
  tone?: "default" | "muted";
  children: ReactNode;
  className?: string;
};

/**
 * Premium form-section wrapper used across the sitter application steps.
 *
 * Design intent:
 *  - Mirrors an Apple/Airbnb vibe: hairline ring, generous padding, soft
 *    elevation, quiet typography.
 *  - Stays visually compatible with the outer candidater/page.tsx shell
 *    (which is already a white rounded card) by using a thinner inner ring
 *    instead of a nested heavy card.
 *  - Icon lives in a small tinted bubble so the section is scannable at a
 *    glance without being loud.
 */
export default function FormSection({
  icon,
  kicker,
  title,
  description,
  tone = "default",
  children,
  className,
}: Props) {
  const toneClass =
    tone === "muted"
      ? "bg-slate-50/60 ring-slate-200/70"
      : "bg-white ring-slate-200/70";

  return (
    <section
      className={`group/section rounded-3xl p-5 ring-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition duration-300 hover:ring-slate-300/80 sm:p-6 ${toneClass} ${className ?? ""}`}
    >
      <header className="mb-5 flex items-start gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--dogshift-blue),transparent_90%)] text-[var(--dogshift-blue)] ring-1 ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] transition group-hover/section:bg-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
          >
            <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          {kicker ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {kicker}
            </p>
          ) : null}
          <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-[17px]">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-4">{children}</div>
    </section>
  );
}
