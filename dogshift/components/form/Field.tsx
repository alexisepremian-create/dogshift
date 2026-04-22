import type { ReactNode } from "react";

type Props = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

/**
 * Wraps a form control with a label, optional hint and a French error slot
 * placed directly below the control, centered and rose-coloured (matching
 * the rest of the authenticated UI error messages).
 */
export default function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: Props) {
  return (
    <div className={className ?? "grid gap-1"}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-slate-700"
      >
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {error ? (
        <p
          role="alert"
          className="mt-1 text-center text-sm font-medium text-rose-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
