import type { ReactNode } from "react";

import { Check } from "lucide-react";

type StepDef = {
  label: string;
  icon?: ReactNode;
};

type Props = {
  /**
   * Either a plain label list (legacy) or a list of {label, icon} items.
   * The icon slot lets the candidater page render a small glyph per step
   * without hardcoding anything in the Stepper itself.
   */
  steps: readonly (string | StepDef)[];
  current: number; // 0-based index of the active step
};

function normalize(steps: Props["steps"]): StepDef[] {
  return steps.map((s) => (typeof s === "string" ? { label: s } : s));
}

/**
 * Premium step indicator.
 *
 * Layout:
 *   [1] ──── [2] ──── [3]
 *     Label    Label    Label
 *
 * States:
 *  - done    → filled dark circle + check glyph
 *  - active  → filled blue circle + step number, with a soft blue halo
 *  - pending → slate outline + muted number
 *
 * The connector line between circles fills progressively as the user
 * advances, which reads a lot more like a premium product tour than the
 * previous bare progress bar.
 */
export default function Stepper({ steps, current }: Props) {
  const items = normalize(steps);
  const total = items.length;
  const progressPct = total <= 1 ? 100 : (current / (total - 1)) * 100;

  return (
    <div
      role="group"
      aria-label={`Étape ${current + 1} sur ${total}`}
      className="grid gap-3"
    >
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <span>
          Étape {current + 1} / {total}
        </span>
        <span className="text-slate-700">{items[current]?.label}</span>
      </div>

      <ol className="relative flex items-start justify-between gap-1">
        {/* Connector track (behind the circles). The wrapper uses left-5/right-5
            so the line starts at the centre of the first circle and stops at
            the centre of the last one, regardless of the container width. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-5 right-5 top-5 h-[2px] overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-[var(--dogshift-blue)] transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {items.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const circle = done
            ? "bg-slate-900 text-white border-slate-900 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.35)]"
            : active
              ? "bg-[var(--dogshift-blue)] text-white border-[var(--dogshift-blue)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]"
              : "bg-white text-slate-400 border-slate-200";

          const labelClass = active
            ? "text-slate-900"
            : done
              ? "text-slate-700"
              : "text-slate-400";

          return (
            <li
              key={`${step.label}-${i}`}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
            >
              <span
                aria-current={active ? "step" : undefined}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition duration-300 ${circle}`}
              >
                {done ? (
                  <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                ) : step.icon ? (
                  <span className="[&>svg]:h-4 [&>svg]:w-4">{step.icon}</span>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-[11px] font-semibold leading-tight sm:text-xs ${labelClass}`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
