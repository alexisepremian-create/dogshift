"use client";

export type Sex = "MALE" | "FEMALE";

/**
 * Segmented Mâle / Femelle selector with a sliding coloured indicator
 * (blue ♂ / pink ♀). Shared by the add-dog modal and the profile editor.
 */
export default function GenderToggle({
  value,
  onChange,
}: {
  value: Sex | null;
  onChange: (v: Sex) => void;
}) {
  const idx = value === "MALE" ? 0 : value === "FEMALE" ? 1 : -1;

  return (
    <div className="relative flex rounded-2xl bg-slate-100 p-1">
      {/* Sliding indicator — only visible once a sex is picked. */}
      {idx >= 0 ? (
        <div
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-xl shadow-sm transition-transform duration-300 ease-out"
          style={{
            transform: idx === 0 ? "translateX(0)" : "translateX(100%)",
            backgroundColor: idx === 0 ? "#3b82f6" : "#ec4899",
          }}
        />
      ) : null}

      <button
        type="button"
        aria-pressed={value === "MALE"}
        onClick={() => onChange("MALE")}
        style={{ touchAction: "manipulation" }}
        className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors ${value === "MALE" ? "text-white" : "text-slate-600"}`}
      >
        <span className="text-base leading-none">♂</span> Mâle
      </button>
      <button
        type="button"
        aria-pressed={value === "FEMALE"}
        onClick={() => onChange("FEMALE")}
        style={{ touchAction: "manipulation" }}
        className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors ${value === "FEMALE" ? "text-white" : "text-slate-600"}`}
      >
        <span className="text-base leading-none">♀</span> Femelle
      </button>
    </div>
  );
}
