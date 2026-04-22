import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: readonly Option[];
  placeholder?: string;
  invalid?: boolean;
};

const BASE =
  "w-full rounded-2xl border bg-white px-4 py-2 pr-11 text-sm leading-5 text-slate-900 shadow-sm outline-none transition appearance-none [-webkit-appearance:none] [-moz-appearance:none] focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] disabled:cursor-not-allowed disabled:opacity-60";

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { options, placeholder, invalid, className, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...rest}
        aria-invalid={invalid || undefined}
        className={`${BASE} ${invalid ? "border-rose-400" : "border-slate-200"} ${className ?? ""}`}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute inset-y-0 right-4 inline-flex items-center text-slate-400"
        aria-hidden="true"
      >
        <ChevronDown className="h-4 w-4" />
      </span>
    </div>
  );
});

export default Select;
