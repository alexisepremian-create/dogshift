import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

const BASE =
  "w-full rounded-2xl border bg-white px-4 py-2 text-sm leading-5 text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] disabled:cursor-not-allowed disabled:opacity-60";

const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${BASE} ${invalid ? "border-rose-400" : "border-slate-200"} ${className ?? ""}`}
    />
  );
});

export default TextInput;
