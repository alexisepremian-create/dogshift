import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

const BASE =
  "w-full rounded-2xl border bg-white px-4 py-3 text-sm leading-5 text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)] disabled:cursor-not-allowed disabled:opacity-60";

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${BASE} ${invalid ? "border-rose-400" : "border-slate-200"} ${className ?? ""}`}
    />
  );
});

export default Textarea;
