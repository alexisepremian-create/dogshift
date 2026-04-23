import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { Check } from "lucide-react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  /**
   * Wraps the control in a premium "card" tile (rounded, ring, soft
   * hover + checked states). Used for consent blocks and multi-select
   * answers. Without this flag the component falls back to a plain inline
   * checkbox (used inside densely-packed forms).
   */
  cardStyle?: boolean;
};

/**
 * Accessible labelled checkbox with two visual modes:
 *  - Plain (default): native-ish checkbox inline with its label.
 *  - `cardStyle`: full tile with a custom check indicator, a refined hover
 *    state and a clear checked state (blue ring + tinted background). The
 *    native input is visually hidden but remains focusable and keyboard-
 *    operable so screen readers and keyboard users get the standard
 *    experience.
 */
const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { label, description, cardStyle, className, id, checked, disabled, ...rest },
  ref,
) {
  if (!cardStyle) {
    return (
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-3 text-sm text-slate-700 ${className ?? ""}`}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--dogshift-blue)] focus:ring-[var(--dogshift-blue)]"
          {...rest}
        />
        <span className="grid gap-1">
          <span>{label}</span>
          {description ? (
            <span className="text-xs text-slate-500">{description}</span>
          ) : null}
        </span>
      </label>
    );
  }

  const stateClass = checked
    ? "border-[var(--dogshift-blue)]/70 bg-[color-mix(in_srgb,var(--dogshift-blue),transparent_94%)] ring-1 ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60";

  const indicatorClass = checked
    ? "border-[var(--dogshift-blue)] bg-[var(--dogshift-blue)] text-white"
    : "border-slate-300 bg-white text-transparent group-hover/checkbox:border-slate-400";

  return (
    <label
      htmlFor={id}
      className={`group/checkbox relative flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm text-slate-800 transition duration-200 focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)] ${stateClass} ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className ?? ""}`}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
        {...rest}
      />
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition duration-200 ${indicatorClass}`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span className="grid gap-0.5">
        <span className="font-medium leading-5 text-slate-900">{label}</span>
        {description ? (
          <span className="text-xs leading-5 text-slate-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
});

export default Checkbox;
