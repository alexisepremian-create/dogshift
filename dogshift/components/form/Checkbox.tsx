import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  description?: ReactNode;
  cardStyle?: boolean;
};

/**
 * Accessible labelled checkbox. `cardStyle` wraps the whole control inside a
 * slate card (used for consent blocks and multi-select answers).
 */
const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { label, description, cardStyle, className, id, ...rest },
  ref,
) {
  const wrapperClass = cardStyle
    ? "flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 cursor-pointer hover:border-slate-300 transition"
    : "flex items-start gap-3 text-sm text-slate-700 cursor-pointer";

  return (
    <label htmlFor={id} className={`${wrapperClass} ${className ?? ""}`}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-[var(--dogshift-blue)] focus:ring-[var(--dogshift-blue)]"
        {...rest}
      />
      <span className="grid gap-1">
        <span>{label}</span>
        {description ? <span className="text-xs text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
});

export default Checkbox;
