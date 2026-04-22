type Props = {
  steps: readonly string[];
  current: number; // 0-based index of the active step
};

export default function Stepper({ steps, current }: Props) {
  const progress = Math.min(
    100,
    Math.max(0, ((current + 1) / steps.length) * 100),
  );

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>
          Étape {current + 1} / {steps.length}
        </span>
        <span className="text-slate-800">{steps[current]}</span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full rounded-full bg-[var(--dogshift-blue)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="grid grid-cols-3 gap-2 text-xs">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={s}
              className={`rounded-xl px-3 py-2 text-center transition ${
                active
                  ? "bg-[var(--dogshift-blue)] text-white shadow-sm"
                  : done
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className="block text-[10px] font-semibold opacity-70">
                {i + 1}
              </span>
              <span className="block text-xs font-semibold">{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
